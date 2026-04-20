/**
 * @name Gimkit Copilot MCP Version
 * @description A MCP Bridge for GKC to MCP Clients
 * @author Coderofpears
 * @version 1
 * @gamemode creative
 * @needsLib Gimbuilder | https://raw.githubusercontent.com/Ashwagandhae/gimbuild/main/plugins/gimbuilder/build/Gimbuilder.js
 * @webpage https://github.com/Coderofpears/Gimloader-Plugins/blob/main/GimkitCopilotMCP.js
 * @downloadUrl https://raw.githubusercontent.com/Coderofpears/Gimloader-Plugins/refs/heads/main/GimkitCopilotMCP.js 
 */

/*

   ____ _           _    _ _      ____            _ _       _   
  / ___(_)_ __ ___ | | _(_) |_   / ___|___  _ __ (_) | ___ | |_ 
 | |  _| | '_ ` _ \| |/ / | __| | |   / _ \| '_ \| | |/ _ \| __|
 | |_| | | | | | | |   <| | |_  | |__| (_) | |_) | | | (_) | |_ 
  \____|_|_| |_| |_|_|\_\_|\__|  \____\___/| .__/|_|_|\___/ \__|
  __  __  ____ ____   __     __            |_|                  
 |  \/  |/ ___|  _ \  \ \   / /__ _ __ ___(_) ___  _ __         
 | |\/| | |   | |_) |  \ \ / / _ \ '__/ __| |/ _ \| '_ \        
 | |  | | |___|  __/    \ V /  __/ |  \__ \ | (_) | | | |       
 |_|  |_|\____|_|        \_/ \___|_|  |___/_|\___/|_| |_|       


  By Coderofpears. I Will release the full version later.                                                              
*/
// ═══════════════════════════════════════════════════════════════════════════════
// Configuration: Change this to your custom server(if you don't trust me)
// ═══════════════════════════════════════════════════════════════════════════════
const SB_URL  = 'https://unztspukhwdzrllavnef.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuenRzcHVraHdkenJsbGF2bmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMzNTAsImV4cCI6MjA4OTE3OTM1MH0.eUWx9O9uX-BqI7oUikVvSAwljgt4Gw3Fl6hb-Xz_YWo';
const MCP_URL = SB_URL + '/functions/v1/mcp';
const STATS_URL = 'https://raw.githubusercontent.com/Coderofpears/Gimloader-Plugins/refs/heads/main/GimkitCopilotStats.txt';

const ALL_TOOL_NAMES = [
  'gkc_create_build','gkc_undo_last_build','gkc_get_map_devices',
  'gkc_look_around','gkc_capture_screenshot','gkc_remove_elements','gkc_vc_checkpoint',
  'gkc_list_devices','gkc_search_terrain','gkc_search_props',
  'gkc_get_device_info','gkc_skill_search','gkc_web_search','gkc_wiki_search',
];
let overlayEl     = null;
let isOpen        = false;
let accessToken   = null;
let currentUser   = null;
let pollTimer     = null;
let isConnected   = false;
let gimbuilds     = [];
let activityLog   = [];
let disabledTools = new Set();
let badgeRef      = null;
let activityElRef = null;
let switchTabFn   = null;
const baseH = () => ({ 'Content-Type': 'application/json', 'apikey': SB_ANON });
const authH = () => ({ ...baseH(), 'Authorization': 'Bearer ' + accessToken });

async function sbSignIn(email, pass) {
  const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password',
    { method: 'POST', headers: baseH(), body: JSON.stringify({ email, password: pass }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.message || 'Sign in failed');
  return { token: d.access_token, user: { id: d.user.id, email: d.user.email } };
}
async function sbSignUp(email, pass) {
  const r = await fetch(SB_URL + '/auth/v1/signup',
    { method: 'POST', headers: baseH(), body: JSON.stringify({ email, password: pass }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.message || 'Sign up failed');
  if (!d.access_token) return { needsConfirmation: true };
  return { token: d.access_token, user: { id: d.user.id, email: d.user.email } };
}
async function sbVerify(token) {
  const r = await fetch(SB_URL + '/auth/v1/user',
    { headers: { ...baseH(), 'Authorization': 'Bearer ' + token } });
  return r.ok ? r.json() : null;
}

const SES_KEY = 'gkc_v5_ses';
const saveSes  = (t,u)=>{ try{localStorage.setItem(SES_KEY,JSON.stringify({t,u}));}catch{} };
const loadSes  = ()=>  { try{const r=localStorage.getItem(SES_KEY);return r?JSON.parse(r):null;}catch{return null;} };
const clearSes = ()=>  { try{localStorage.removeItem(SES_KEY);}catch{} };

const DT_KEY = 'gkc_v5_dt';
function loadDisabledTools() { try{const r=localStorage.getItem(DT_KEY);return new Set(r?JSON.parse(r):[]);}catch{return new Set();} }
function saveDisabledTools() {
  try{localStorage.setItem(DT_KEY,JSON.stringify([...disabledTools]));}catch{}
  if (!accessToken||!currentUser) return;
  fetch(SB_URL+'/rest/v1/user_settings',{
    method:'POST',
    headers:{...authH(),'Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({user_id:currentUser.id,disabled_tools:[...disabledTools]}),
  }).catch(()=>{});
}
async function checkAnnouncement() {
  try {
    const r = await fetch(STATS_URL + '?_=' + Date.now()); // bust cache
    if (!r.ok) return;
    const text = (await r.text()).trim();
    if (!text || text.toLowerCase() === 'false') return;
    showAnnouncementBanner(text);
  } catch {}
}

function showAnnouncementBanner(text) {
  if (!document.getElementById('gkc-st')) {
    injectStyles();
  }

  const ov = document.createElement('div');
  ov.id = 'gkc-ann-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100000;display:flex;align-items:center;justify-content:center;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#0e0e0e;border:1px solid #f59e0b;border-radius:12px;padding:28px 28px 22px;max-width:480px;width:92vw;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-shadow:0 0 40px rgba(245,158,11,.25);';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;';
  const icon = document.createElement('span'); icon.textContent = '📢'; icon.style.fontSize = '20px';
  const title = document.createElement('span'); title.style.cssText = 'font-size:14px;font-weight:800;color:#f59e0b;letter-spacing:-.2px;'; title.textContent = 'GimkitCopilot Announcement';
  titleRow.append(icon, title);

  const content = document.createElement('div');
  content.style.cssText = 'color:#ddd;font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word;max-height:55vh;overflow-y:auto;padding-right:4px;';
  content.textContent = text;

  const dismissBtn = document.createElement('button');
  dismissBtn.style.cssText = 'margin-top:18px;width:100%;background:#1a1400;border:1px solid #f59e0b;color:#f59e0b;border-radius:7px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;';
  dismissBtn.textContent = 'Got it — Continue';
  dismissBtn.onclick = () => ov.remove();

  box.append(titleRow, content, dismissBtn);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

async function fetchPending() {
  const r = await fetch(SB_URL+'/rest/v1/tool_calls?status=eq.pending&order=created_at.asc&limit=5',
    {headers:authH()});
  if (!r.ok) throw new Error('poll '+r.status);
  return r.json();
}
async function writeResult(id, result, status) {
  await fetch(SB_URL+'/rest/v1/tool_calls?id=eq.'+id,{
    method:'PATCH',
    headers:{...authH(),'Prefer':'return=minimal'},
    body:JSON.stringify({result,status,completed_at:new Date().toISOString()}),
  });
}
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async()=>{
    try {
      const calls = await fetchPending();
      if (!isConnected){isConnected=true;updateBadge();notify('success','Gimkit Copilot MCP ● Connected');}
      for (const call of calls){
        const t0=Date.now();let result,status;
        if (disabledTools.has(call.name)){result={error:'Tool "'+call.name+'" is disabled. Enable it in GimkitCopilot (Shift+X).'};status='error';}
        else{try{result=await execClientTool(call.name,call.args||{});status='complete';}catch(e){result={error:e.message};status='error';}}
        await writeResult(call.id,result,status);
        logActivity(call.name,status,Date.now()-t0);
      }
    }catch{if(isConnected){isConnected=false;updateBadge();notify('error','Gimkit Copilot MCP disconnected');}}
  },1200);
}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}isConnected=false;updateBadge();}
async function execClientTool(name, args) {
  switch(name){
    case 'gkc_create_build':       return await toolBuild(args);
    case 'gkc_undo_last_build':    return await toolUndo();
    case 'gkc_get_map_devices':    return toolGetDevices(args);
    case 'gkc_look_around':        return await toolLookAround(args);
    case 'gkc_capture_screenshot': return await toolScreenshot(args);
    case 'gkc_remove_elements':    return toolRemove(args);
    case 'gkc_vc_checkpoint':      return toolCheckpoint(args.message);
    default: return {error:'Unknown client tool: '+name};
  }
}

async function toolBuild({devices=[],wires=[]}){
  if(!devices.length)return{success:false,error:'No devices.'};
  const norm=devices.map((d,i)=>({id:d.id||'d'+i,type:d.type,options:d.options||{},transform:{x:d.x??0,y:d.y??0,depth:d.depth??0},...(d.codeGrids?.length?{codeGrids:d.codeGrids}:{})}));
  const px=GL.stores.phaser.mainCharacter.body.x,py=GL.stores.phaser.mainCharacter.body.y;
  const GB=await api.lib('Gimbuilder');
  const res=await GB.build({type:'relative',devices:norm},GL.stores.phaser.mainCharacter.body);
  if(!res.ok)return{success:false,error:'Gimbuilder: '+JSON.stringify(res.val)};
  gimbuilds.push(res.val);
  let wp=0;
  if(wires.length){
    const placed=api.stores.phaser.scene.worldManager.devices.allDevices;
    const ids={};norm.forEach((nd,i)=>{const p=placed[placed.length-norm.length+i];if(p)ids[nd.id]=p.id;});
    for(const w of wires){const fId=ids[w.from],tId=ids[w.to];if(!fId||!tId)continue;api.net.send('PLACE_WIRE',{startConnection:w.fromConnection,startDevice:fId,endConnection:w.toConnection,endDevice:tId});wp++;}
  }
  return{success:true,message:'Built '+devices.length+' device(s)'+(wp?' + '+wp+' wire(s)':'')+' near ('+Math.round(px)+','+Math.round(py)+')',deviceIds:res.val.deviceIds};
}
async function toolUndo(){if(!gimbuilds.length)return{success:false,error:'Nothing to undo.'};const GB=await api.lib('Gimbuilder');GB.unbuild(gimbuilds.pop());return{success:true,remaining:gimbuilds.length};}
function toolGetDevices(args={}){
  const{worldManager}=api.stores.phaser.scene;
  let devs=worldManager.devices.allDevices.map(d=>{const e={id:d.id,type:d.deviceOption.id,x:Math.round(d.x),y:Math.round(d.y)};if(args.includeOptions!==false){const o={};for(const[k,v]of Object.entries(d.options)){if(v!=null&&v!=='')o[k]=v;}if(Object.keys(o).length)e.options=o;}return e;});
  if(args.areaFilter){const{centerX,centerY,radius}=args.areaFilter;devs=devs.filter(d=>Math.hypot(d.x-centerX,d.y-centerY)<=radius);}
  const tiles=[...api.stores.world.terrain.tiles.values()].map(t=>({type:t.id||t.terrainId,x:t.x,y:t.y,depth:t.depth}));
  const wires=args.includeWires!==false?[...worldManager.wires.wires.values()].map(w=>({id:w.id,from:{deviceId:w.startDeviceId,connection:w.startConnection},to:{deviceId:w.endDeviceId,connection:w.endConnection}})):[];
  const counts={};devs.forEach(d=>{counts[d.type]=(counts[d.type]||0)+1;});
  return{success:true,summary:{devices:devs.length,tiles:tiles.length,wires:wires.length},deviceCounts:counts,devices:devs,tiles,wires};
}
async function toolLookAround({radius=600,zoom=0.8}={}){
  const x=GL.stores.phaser.mainCharacter.body.x,y=GL.stores.phaser.mainCharacter.body.y;
  const r=await toolScreenshot({centerX:x,centerY:y,width:radius*2,height:radius*2,zoom});
  if(r.success)r.message='Area around player ('+Math.round(x)+','+Math.round(y)+') radius '+radius;return r;
}
async function toolScreenshot({centerX,centerY,width=500,height=500,zoom=1.0}){
  const scene=api.stores.phaser.scene,cam=scene.cameras.cameras[0];
  if(!cam)return{success:false,error:'Camera not available'};
  const oz=cam.zoom,ox=cam.scrollX,oy=cam.scrollY,ofol=scene.cameraHelper?.isFollowing;
  if(ofol&&scene.cameraHelper?.stopFollow)scene.cameraHelper.stopFollow();
  cam.setZoom(zoom);cam.scrollX=centerX-cam.width/zoom/2;cam.scrollY=centerY-cam.height/zoom/2;
  scene.game.renderer.render(scene,cam);
  await new Promise(r=>setTimeout(r,100));
  const image=scene.game.canvas.toDataURL('image/png');
  cam.setZoom(oz);cam.scrollX=ox;cam.scrollY=oy;
  if(ofol&&scene.cameraHelper?.startFollowingObject)scene.cameraHelper.startFollowingObject({object:GL.stores.phaser.mainCharacter.body});
  return{success:true,image,location:{x:centerX,y:centerY},zoom};
}
function toolRemove({deviceIds=[],tilePositions=[],wireIds=[],customAssetIds=[]}){
  const r={devices:0,tiles:0,wires:0,assets:0};
  deviceIds.forEach(id=>{api.net.send('REMOVE_DEVICE',{id});r.devices++;});
  tilePositions.forEach(p=>{api.net.send('REMOVE_TERRAIN',{x:p.x,y:p.y,depth:p.depth});r.tiles++;});
  wireIds.forEach(id=>{api.net.send('REMOVE_WIRE',{id});r.wires++;});
  customAssetIds.forEach(id=>{api.net.send('REMOVE_CUSTOM_ASSET',{id});r.assets++;});
  return{success:true,removed:r,total:r.devices+r.tiles+r.wires+r.assets};
}
function toolCheckpoint(message){
  const PREF='mapvc_';
  const name=(()=>{try{return JSON.parse(localStorage.getItem(PREF+'current_project'));}catch{return null;}})();
  if(!name)return{success:false,error:'No MapVersionControl project active. Open MapVersionControl (Shift+B) first.'};
  const{worldManager}=api.stores.phaser.scene;
  const state={
    tiles:[...api.stores.world.terrain.tiles.values()],
    devices:worldManager.devices.allDevices.map(d=>({id:d.id,deviceTypeId:d.deviceOption.id,options:JSON.stringify(d.options).replace('"trackedItemId":null','"trackedItemId":undefined'),x:d.x,y:d.y})),
    wires:[...worldManager.wires.wires.values()].map(w=>({id:w.id,startConnection:w.startConnection,endConnection:w.endConnection,startDeviceId:w.startDeviceId,endDeviceId:w.endDeviceId})),
    customAssets:[...api.stores.world.customAssets.customAssets.values()],
  };
  const key=PREF+'project_'+name;
  const proj=(()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}})()||{name,currentBranch:'main',branches:{main:{name:'main',commits:[],head:null}},stash:[]};
  const branch=proj.branches[proj.currentBranch];
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2);
  branch.commits.push({id,message:message||'AI Checkpoint',timestamp:Date.now(),parent:branch.head,state});
  branch.head=id;localStorage.setItem(key,JSON.stringify(proj));
  return{success:true,message:'Checkpoint "'+message+'" ('+id.slice(0,7)+') in "'+name+'"'};
}

async function placeWatermark(){
  try{
    const{worldManager}=api.stores.phaser.scene;
    for(const d of worldManager.devices.allDevices){if(/^gkc-[a-z0-9]{6}$/.test(d.options?.text||''))return;}
    const tag='gkc-'+Math.random().toString(36).slice(2,8);
    const GB=await api.lib('Gimbuilder');
    const res=await GB.build({type:'relative',devices:[{type:'textBillboard',options:{text:tag,color:'#888888',fontSize:4,alpha:0.05},transform:{x:-300,y:-300,depth:-10}}]},GL.stores.phaser.mainCharacter.body);
    if(res.ok)gimbuilds.push(res.val);
  }catch{}
}

function logActivity(name,status,ms){activityLog.unshift({name,status,ms});if(activityLog.length>30)activityLog.pop();renderActivity();}
function renderActivity(){
  if(!activityElRef)return;activityElRef.innerHTML='';
  if(!activityLog.length){activityElRef.innerHTML='<div style="color:#555;font-size:11px;text-align:center;padding:16px 0">No tool calls yet</div>';return;}
  for(const e of activityLog){
    const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:4px;background:#111;margin-bottom:2px;';
    const icon=document.createElement('span');icon.textContent=e.status==='complete'?'✅':e.status==='error'?'❌':'⏳';
    const nm=document.createElement('span');nm.style.cssText='flex:1;color:#ccc;font-size:11px;font-family:monospace;';nm.textContent=e.name;
    const mt=document.createElement('span');mt.style.cssText='color:#444;font-size:10px;';mt.textContent=e.ms!=null?e.ms+'ms':'…';
    row.append(icon,nm,mt);activityElRef.appendChild(row);
  }
}

function updateBadge(){
  if(!badgeRef)return;
  badgeRef.textContent=isConnected?'● Connected':currentUser?'○ Connecting…':'○ Not signed in';
  badgeRef.style.color=isConnected?'#4CAF50':currentUser?'#f59e0b':'#555';
}
function notify(type,msg){try{api.notification[type](msg);}catch{}}
function getSnippets(token){
  const t=token||'<YOUR-TOKEN>',u=MCP_URL;
  return{
    'Claude Desktop':{note:'Add to ~/Library/Application Support/Claude/claude_desktop_config.json',code:JSON.stringify({mcpServers:{'gimkit-copilot':{url:u,headers:{Authorization:'Bearer '+t}}}},null,2)},
    'Claude Code':   {note:'Run in terminal',code:'claude mcp add gimkit-copilot '+u+' --header "Authorization: Bearer '+t+'"'},
    'VS Code':       {note:'Add to .vscode/mcp.json (VS Code 1.99+ with MCP enabled)',code:JSON.stringify({servers:{'gimkit-copilot':{type:'http',url:u,headers:{Authorization:'Bearer '+t}}}},null,2)},
    'Cursor':        {note:'Add to ~/.cursor/mcp.json',code:JSON.stringify({mcpServers:{'gimkit-copilot':{url:u,headers:{Authorization:'Bearer '+t}}}},null,2)},
    'Codex CLI':     {note:'Run in terminal (requires OpenAI Codex CLI)',code:'codex mcp add --name gimkit-copilot --url '+u+' --header "Authorization: Bearer '+t+'"'},
    'Groq Playground':{note:'Tools → Add MCP Server → paste URL and token below',code:'URL:\n'+u+'\n\nAuthorization header:\nBearer '+t},
    'Python':        {note:'pip install mcp — then run this script',code:'from mcp.client.streamable_http import streamablehttp_client\nfrom mcp import ClientSession\nimport asyncio\n\nURL     = "'+u+'"\nHEADERS = {"Authorization": "Bearer '+t+'"}\n\nasync def main():\n    async with streamablehttp_client(URL, headers=HEADERS) as (r, w, _):\n        async with ClientSession(r, w) as s:\n            await s.initialize()\n            tools = await s.list_tools()\n            print([t.name for t in tools.tools])\n\nasyncio.run(main())'},
    'cURL':          {note:'Test from your terminal (no plugin needed for server-side tools)',code:'curl -X POST '+u+' \\\n  -H "Authorization: Bearer '+t+'" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\''},
  };
}
function injectStyles(){
  if(document.getElementById('gkc-st'))return;
  const s=document.createElement('style');s.id='gkc-st';
  s.textContent=`
    #gkc-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99998;display:flex;align-items:center;justify-content:center;}
    #gkc-pp{background:#0d0d0d;border:1px solid #222;border-radius:12px;width:500px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.8);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#ddd;}
    #gkc-pp *{box-sizing:border-box;}
    #gkc-pp ::-webkit-scrollbar{width:3px;}
    #gkc-pp ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px;}
    .gkt{padding:7px 16px;border:none;background:transparent;color:#555;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;font-weight:600;}
    .gkt:hover{color:#aaa;}
    .gkt.on{color:#4CAF50;border-bottom-color:#4CAF50;}
    .gkin{background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:8px 10px;color:#eee;font-size:12px;font-family:inherit;width:100%;outline:none;}
    .gkin:focus{border-color:#4CAF50;}
    .gkb{border:none;border-radius:6px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
    .gkb:hover{opacity:.85;}
    .gkcode{background:#060606;border:1px solid #1a1a1a;border-radius:6px;padding:9px 11px;font-family:'SF Mono','Fira Code',monospace;font-size:10px;color:#4af626;white-space:pre-wrap;word-break:break-all;line-height:1.5;margin:0;}
    .gkprov{padding:3px 10px;border:1px solid #222;border-radius:4px;background:transparent;color:#666;font-size:10px;cursor:pointer;font-family:inherit;font-weight:600;}
    .gkprov.on{background:#142014;border-color:#4CAF50;color:#4CAF50;}
  `;
  document.head.appendChild(s);
}
function buildPopup(){
  if(overlayEl)return;
  injectStyles();

  overlayEl=document.createElement('div');overlayEl.id='gkc-ov';
  overlayEl.onclick=e=>{if(e.target===overlayEl)closePopup();};

  const pp=document.createElement('div');pp.id='gkc-pp';
  const hdr=document.createElement('div');hdr.style.cssText='padding:13px 16px 0;background:#111;border-bottom:1px solid #1a1a1a;flex-shrink:0;';
  const tr=document.createElement('div');tr.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;';
  const logo=document.createElement('div');
  logo.innerHTML='<span style="color:#4CAF50;margin-right:4px">◆</span><b style="color:#fff;font-size:14px">GimkitCopilot</b><span style="color:#2a2a2a;font-size:11px;margin-left:6px">MCP v1</span>';
  badgeRef=document.createElement('span');badgeRef.style.cssText='font-size:11px;font-weight:600;';updateBadge();
  const xBtn=document.createElement('button');xBtn.style.cssText='background:none;border:none;color:#444;font-size:16px;cursor:pointer;margin-left:8px;';xBtn.textContent='✕';xBtn.onclick=closePopup;
  const rh=document.createElement('div');rh.style.cssText='display:flex;align-items:center;gap:8px;';rh.append(badgeRef,xBtn);
  tr.append(logo,rh);

  const tabRow=document.createElement('div');tabRow.style.cssText='display:flex;';
  const TABS=['Account','Connect','Tools'];
  const tBtns={},tPanels={};let activeTab='Account';
  function switchTab(name){activeTab=name;TABS.forEach(n=>{tBtns[n].classList.toggle('on',n===name);if(tPanels[n])tPanels[n].style.display=n===name?'block':'none';});}
  switchTabFn=switchTab;
  TABS.forEach(n=>{const b=document.createElement('button');b.className='gkt'+(n===activeTab?' on':'');b.textContent=n;tBtns[n]=b;b.onclick=()=>switchTab(n);tabRow.appendChild(b);});
  hdr.append(tr,tabRow);pp.appendChild(hdr);

  const body=document.createElement('div');body.style.cssText='flex:1;overflow-y:auto;';pp.appendChild(body);
  const mkP=()=>{const p=document.createElement('div');p.style.cssText='padding:16px;';body.appendChild(p);return p;};

  const accPanel=mkP();tPanels['Account']=accPanel;

  const tokView=document.createElement('div');tokView.style.display='none';
  const tokInfo=document.createElement('div');tokInfo.style.cssText='font-size:11px;color:#888;margin-bottom:8px;line-height:1.5;';
  tokInfo.textContent='Your MCP token. Paste this as the Bearer token in your AI client. Expires ~1 hour — re-open to get a fresh one.';
  const tokField=document.createElement('input');tokField.className='gkin gkcode';
  tokField.style.cssText='font-size:9px;color:#4af626;background:#040804;border-color:#142014;';tokField.readOnly=true;
  const tokCopyBtn=document.createElement('button');tokCopyBtn.className='gkb';
  tokCopyBtn.style.cssText='background:#142014;border:1px solid #2a5a2a;color:#4CAF50;width:100%;margin-top:6px;';tokCopyBtn.textContent='📋 Copy Token';
  tokCopyBtn.onclick=()=>navigator.clipboard.writeText(accessToken||'').then(()=>{tokCopyBtn.textContent='✅ Copied!';setTimeout(()=>{tokCopyBtn.textContent='📋 Copy Token';},1800);});
  const epDiv=document.createElement('div');epDiv.style.cssText='font-size:10px;color:#2a2a2a;margin-top:8px;word-break:break-all;';
  epDiv.innerHTML='<span style="color:#3a3a3a">MCP:</span> <span style="font-family:monospace;color:#2a5a2a">'+MCP_URL+'</span>';
  const signedAs=document.createElement('div');signedAs.style.cssText='font-size:11px;color:#4CAF50;font-weight:600;margin-bottom:8px;';
  const soBtn=document.createElement('button');soBtn.className='gkb';
  soBtn.style.cssText='background:#1a0000;border:1px solid #5a1a1a;color:#ef4444;font-size:11px;width:100%;margin-top:10px;';soBtn.textContent='🚪 Sign Out';
  tokView.append(signedAs,tokInfo,tokField,tokCopyBtn,epDiv,soBtn);

  const authForm=document.createElement('div');
  const emailIn=document.createElement('input');emailIn.className='gkin';emailIn.type='email';emailIn.placeholder='Email';
  const passIn=document.createElement('input');passIn.className='gkin';passIn.type='password';passIn.placeholder='Password';passIn.style.marginTop='7px';
  const btnRow=document.createElement('div');btnRow.style.cssText='display:flex;gap:7px;margin-top:8px;';
  const siBtn=document.createElement('button');siBtn.className='gkb';siBtn.style.cssText='flex:1;background:#1565c0;color:#fff;';siBtn.textContent='Sign In';
  const suBtn=document.createElement('button');suBtn.className='gkb';suBtn.style.cssText='flex:1;background:#181818;border:1px solid #2a2a2a;color:#aaa;';suBtn.textContent='Create Account';
  btnRow.append(siBtn,suBtn);
  const authMsg=document.createElement('div');authMsg.style.cssText='font-size:11px;min-height:14px;margin-top:6px;';
  authForm.append(emailIn,passIn,btnRow,authMsg);
  accPanel.append(tokView,authForm);

  async function doSignIn(){
    const em=emailIn.value.trim(),pw=passIn.value;
    if(!em||!pw){authMsg.style.color='#ef4444';authMsg.textContent='Enter email and password.';return;}
    authMsg.style.color='#888';authMsg.textContent='Signing in…';
    try{const{token,user}=await sbSignIn(em,pw);onSignedIn(token,user);authMsg.textContent='';}
    catch(e){authMsg.style.color='#ef4444';authMsg.textContent=e.message;}
  }
  async function doSignUp(){
    const em=emailIn.value.trim(),pw=passIn.value;
    if(!em||!pw){authMsg.style.color='#ef4444';authMsg.textContent='Enter email and password.';return;}
    if(pw.length<6){authMsg.style.color='#ef4444';authMsg.textContent='Password must be ≥6 chars.';return;}
    authMsg.style.color='#888';authMsg.textContent='Creating account…';
    try{
      const r=await sbSignUp(em,pw);
      if(r.needsConfirmation){authMsg.style.color='#4CAF50';authMsg.textContent='📧 Check your email to confirm, then sign in.';return;}
      onSignedIn(r.token,r.user);authMsg.textContent='';
    }catch(e){authMsg.style.color='#ef4444';authMsg.textContent=e.message;}
  }
  siBtn.onclick=doSignIn;suBtn.onclick=doSignUp;
  passIn.addEventListener('keydown',e=>{if(e.key==='Enter')doSignIn();});
  soBtn.onclick=async()=>{stopPolling();clearSes();accessToken=null;currentUser=null;tokView.style.display='none';authForm.style.display='';authMsg.textContent='';updateBadge();notify('success','GimkitCopilot: signed out');};

  function showSignedIn(){authForm.style.display='none';tokView.style.display='';signedAs.textContent='Signed in as '+currentUser.email;tokField.value=accessToken||'';}
  function onSignedIn(token,user){
    accessToken=token;currentUser=user;saveSes(token,user);disabledTools=loadDisabledTools();
    placeWatermark();startPolling();showSignedIn();updateBadge();
    notify('success','GimkitCopilot: signed in as '+user.email);
    switchTab('Connect');refreshConnectPanel();renderToolsPanel();
  }
  if(currentUser)showSignedIn();
  const conPanel=mkP();conPanel.style.display='none';tPanels['Connect']=conPanel;
  const conNote=document.createElement('div');conNote.style.cssText='font-size:11px;color:#666;margin-bottom:12px;line-height:1.5;';
  conNote.textContent='Select your client and copy the config. Keep this plugin open in Gimkit Creative with ● Connected before calling map tools.';
  const provRow=document.createElement('div');provRow.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;';
  const provNote=document.createElement('div');provNote.style.cssText='font-size:10px;color:#555;margin-bottom:5px;';
  const provCode=document.createElement('pre');provCode.className='gkcode';
  const cpBtn=document.createElement('button');cpBtn.className='gkb';cpBtn.style.cssText='background:#111;border:1px solid #222;color:#777;width:100%;margin-top:5px;font-size:11px;';cpBtn.textContent='📋 Copy';
  cpBtn.onclick=()=>navigator.clipboard.writeText(provCode.textContent||'').then(()=>{cpBtn.textContent='✅ Copied!';setTimeout(()=>{cpBtn.textContent='📋 Copy';},1600);});
  const providers=Object.keys(getSnippets(null));
  let activeProv=providers[0];const provBtns={};
  function switchProv(name){activeProv=name;providers.forEach(p=>{provBtns[p].classList.toggle('on',p===name);});const s=getSnippets(accessToken);provNote.textContent=s[name].note;provCode.textContent=s[name].code;}
  providers.forEach(name=>{const b=document.createElement('button');b.className='gkprov'+(name===activeProv?' on':'');b.textContent=name;provBtns[name]=b;b.onclick=()=>switchProv(name);provRow.appendChild(b);});
  switchProv(activeProv);
  conPanel.append(conNote,provRow,provNote,provCode,cpBtn);
  function refreshConnectPanel(){switchProv(activeProv);}
  const toolsPanel=mkP();toolsPanel.style.display='none';tPanels['Tools']=toolsPanel;
  const tlNote=document.createElement('div');tlNote.style.cssText='font-size:11px;color:#666;margin-bottom:10px;';
  tlNote.textContent='Disable tools to hide them from your AI client and block execution. Synced to the server.';
  const toolsList=document.createElement('div');
  toolsPanel.append(tlNote,toolsList);

  function renderToolsPanel(){
    toolsList.innerHTML='';
    const groups=[
      {label:'Browser Tools (plugin must be open & connected)',names:ALL_TOOL_NAMES.slice(0,7)},
      {label:'Server Tools (run in Supabase edge function)',names:ALL_TOOL_NAMES.slice(7)},
    ];
    groups.forEach(({label,names})=>{
      const grp=document.createElement('div');grp.style.marginBottom='12px';
      const lbl=document.createElement('div');lbl.style.cssText='font-size:10px;color:#444;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;';lbl.textContent=label;
      grp.appendChild(lbl);
      names.forEach(name=>{
        const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#111;border-radius:5px;margin-bottom:3px;';
        const nm=document.createElement('span');nm.style.cssText='font-size:11px;font-family:monospace;color:#ccc;';nm.textContent=name;
        const tog=document.createElement('button');const dis=disabledTools.has(name);
        tog.style.cssText='border:none;border-radius:10px;padding:2px 10px;font-size:10px;font-weight:700;cursor:pointer;background:'+(dis?'#333':'#4CAF50')+';color:'+(dis?'#666':'#fff')+';';
        tog.textContent=dis?'OFF':'ON';
        tog.onclick=()=>{if(disabledTools.has(name))disabledTools.delete(name);else disabledTools.add(name);saveDisabledTools();const d2=disabledTools.has(name);tog.style.background=d2?'#333':'#4CAF50';tog.style.color=d2?'#666':'#fff';tog.textContent=d2?'OFF':'ON';};
        row.append(nm,tog);grp.appendChild(row);
      });
      toolsList.appendChild(grp);
    });
    const btnR=document.createElement('div');btnR.style.cssText='display:flex;gap:6px;margin-top:6px;';
    const allOff=document.createElement('button');allOff.className='gkb';allOff.style.cssText='background:#111;border:1px solid #222;color:#666;font-size:10px;';allOff.textContent='Disable All';
    allOff.onclick=()=>{ALL_TOOL_NAMES.forEach(n=>disabledTools.add(n));saveDisabledTools();renderToolsPanel();};
    const allOn=document.createElement('button');allOn.className='gkb';allOn.style.cssText='background:#142014;border:1px solid #2a5a2a;color:#4CAF50;font-size:10px;';allOn.textContent='Enable All';
    allOn.onclick=()=>{disabledTools.clear();saveDisabledTools();renderToolsPanel();};
    btnR.append(allOff,allOn);toolsList.appendChild(btnR);
  }
  if(currentUser)renderToolsPanel();

  overlayEl.appendChild(pp);document.body.appendChild(overlayEl);
}

function openPopup(tab){buildPopup();overlayEl.style.display='flex';isOpen=true;if(tab&&switchTabFn)switchTabFn(tab);updateBadge();}
function closePopup(){if(overlayEl)overlayEl.style.display='none';isOpen=false;}
function togglePopup(tab){if(isOpen)closePopup();else openPopup(tab);}
api.commands.addCommand({text:'[GimkitCopilot] Open / Sign In'},()=>openPopup('Account'));
api.commands.addCommand({text:'[GimkitCopilot] Copy MCP Token'},()=>{
  if(!accessToken){notify('warn','GimkitCopilot: not signed in');openPopup('Account');return;}
  navigator.clipboard.writeText(accessToken).then(()=>notify('success','GimkitCopilot: token copied to clipboard'));
});
api.commands.addCommand({text:'[GimkitCopilot] Connection Guide'},()=>openPopup('Connect'));
api.commands.addCommand({text:'[GimkitCopilot] Manage Tools'},    ()=>openPopup('Tools'));
api.commands.addCommand({text:'[GimkitCopilot] Sign Out'},async()=>{
  if(!currentUser){notify('warn','GimkitCopilot: not signed in');return;}
  stopPolling();clearSes();accessToken=null;currentUser=null;updateBadge();
  notify('success','GimkitCopilot: signed out');
});
api.hotkeys.addConfigurableHotkey({
  category:'GimkitCopilot',title:'Toggle Setup Popup',
  preventDefault:true,default:{key:'KeyX',shift:true}
},()=>togglePopup('Account'));

api.net.onLoad(async()=>{
  disabledTools=loadDisabledTools();

  // Check announcement banner (runs regardless of auth state)
  checkAnnouncement();

  // Restore session
  const saved=loadSes();
  if(saved?.t){
    try{
      const user=await sbVerify(saved.t);
      if(user?.id){
        accessToken=saved.t;currentUser={id:user.id,email:user.email};
        await placeWatermark();startPolling();return;
      }
    }catch{}
    clearSes();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════
api.onStop(()=>{
  stopPolling();
  overlayEl?.remove();overlayEl=null;
  document.getElementById('gkc-st')?.remove();
  isOpen=false;switchTabFn=null;badgeRef=null;activityElRef=null;
  (async()=>{try{const GB=await api.lib('Gimbuilder');while(gimbuilds.length)GB.unbuild(gimbuilds.pop());}catch{}})();
});

// Under is the Edge Function Code that lives on the server

/*
// GimkitCopilot MCP Server 
// Auth: initialize/ping/notifications/tools/list = public
//       tools/call = requires Supabase JWT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

//This is the Official backend server function I have 

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = new Set([
  'https://www.gimkit.com','https://gimkit.com',
  'https://www.gimkitconnect.com','https://gimkitconnect.com',
])
function corsHeaders(origin: string | null): Record<string,string> {
  const safe = origin !== null && (ALLOWED_ORIGINS.has(origin) || /\.gimkit\.com$/.test(origin) || /\.gimkitconnect\.com$/.test(origin))
  return {
    'Access-Control-Allow-Origin': safe ? origin! : 'https://www.gimkit.com',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  }
}

// Static GKC Data
const DEVICE_CATS: Record<string,string[]> = {
  starter:     ['textBillboard','button','trigger','questioner','counter','spawnPad'],
  inventory:   ['itemGranter','itemSpawner','vendingMachine','inventoryItemManager'],
  interaction: ['popup','barrier','zone','teleporter','damageBoost','door'],
  advanced:    ['relay','lifecycle','teamSwitcher','overlay','notification','wireRepeater'],
  logic:       ['checker','property','knockoutManager','repeater'],
  combat:      ['sentry','laser','laserManager','damager','healthGranter','speedModifier'],
  game:        ['endGame','flag','flagCaptureZone','ball','respawn'],
}
const TERRAIN = [
  'Asphalt Road','Blastball Court','Boardwalk','Castle Tile (Green)','Castle Tile (Purple)',
  'Castle Tile (Red)','Cinema Carpet','Concrete','Cracked Oak','Dark Scraps','Dirt','Disco',
  'Dry Grass','Dungeon (Blue)','Dungeon (Gray)','Dungeon (Green)','Dungeon (Purple)',
  'Dynamic Copper','Dynamic Diamond','Dynamic Dirt','Dynamic Gold','Dynamic Ruby','Dynamic Sand',
  'Dynamic Silver','Dynamic Stone','Exposed Boardwalk','Frozen Lake','Grass','Gym Floor',
  'Lab Floor (Blue)','Lab Floor (Green)','Lab Floor (Magenta)','Lab Floor (White)','Light Scraps',
  'Marble Stone (Dark)','Marble Stone (Light)','Metallic (Dark)','Metallic (Light)',
  'Plastic (Blue)','Plastic (Green)','Plastic (Purple)','Plastic (Red)','Purple Grass',
  'Purple Sand','Sand','Snow','Snowy Grass','Space','Space (Moving)','Space Rock',
  'Spaceship Catwalk (Grills)','Spaceship Catwalk (Lined)','Spaceship Corridor',
  'Spaceship Corridor (White)','Spaceship Interior','Speckled Gray','Stone (Brown)',
  'Stone (Dark)','Stone (Light)','Stone Pavement (Dry Grass)','Stone Pavement (Grass)',
  'Stone Pavement (Purple Grass)','Water','Water (Dark Blue)','Water (Gray)','Water (Pink)',
  'Water (Purple)','Water (White)',
]
const PROPS: Record<string,string[]> = {
  science:   ['3D Printer','Chemical Tube','Blue Chemical','Broken Glass'],
  medieval:  ['Anvil','Armor Display','Barrel','Barrel (Empty)','Firewood','Coal'],
  nature:    ['Alien Plant','Bush','Dry Bush','Coral','Flower','Flower Pot'],
  furniture: ['Bookshelf','Desk','Filing Cabinet','Command Table'],
  sports:    ['Basketball','Basketball Hoop','Arena Flag (Blue)','Arena Flag (Red)','Cone'],
  buildings: ['Barn (Closed)','Circus Tent (Blue)','Circus Tent (Red)'],
  misc:      ['Arcade Machine (On)','Barrier (Horizontal)','Blackboard (Tall)','Boat'],
}
const DEV_OPTS: Record<string,unknown> = {
  button:        { message:'string', interactionDuration:'number', activeOnStart:'Yes/No', scope:'player/team/global' },
  trigger:       { triggerByPlayerCollision:'Yes/No', triggerDelay:'number (seconds)', visibleInGame:'Yes/No' },
  counter:       { startingValue:'number', targetValue:'number', incrementAmount:'number', scope:'player/team/global' },
  textBillboard: { text:'string', color:'hex (#RRGGBB)', fontSize:'number', alpha:'0.0-1.0' },
  barrier:       { color:'hex', alpha:'0.0-1.0', width:'number', height:'number', activeOnStart:'Yes/No', scope:'player/team/global' },
  teleporter:    { group:'string', targetGroup:'string' },
  lifecycle:     { eventType:'gameStart|gameEnd|playerJoin|playerLeave|playerKnockedOut' },
  relay:         { relayTo:'allPlayers|allPlayersOnTeam|randomPlayer|randomPlayerOnTeam' },
  property:      { propertyName:'string', propertyType:'number|text', defaultValue:'any', scope:'player/team/global' },
  spawnPad:      { teamNumber:'number', activeOnStart:'Yes/No' },
  sentry:        { health:'number', gadgetId:'blaster|zapper|slingshot|evil-eye|quantum-portal', team:'number', activeOnStart:'Yes/No' },
  overlay:       { overlayType:'text|button', content:'string', scope:'player/global' },
  checker:       { checkType:'property|item', propertyName:'string', checkOperator:'>|<|=|!=', value:'any' },
  repeater:      { interval:'number (seconds)', maxRepetitions:'number (0=infinite)', startOnGameStart:'Yes/No' },
  itemGranter:   { itemId:'cash|amber|energy|ore|wood|fish|medpack|shield-can|blaster|zapper', itemAmount:'number (negative=take)' },
  vendingMachine:{ itemCostId:'string', itemCostAmount:'number', itemGrantId:'string', itemGrantAmount:'number', maxUses:'number (0=unlimited)' },
}
const SKILL = `# Gimkit Creative — Complete Reference
 
## Core Concepts
 
### Memory
- **Total limit: 100,000 memory per map**
- Every placed object consumes memory. Budget carefully on large maps.
- Key memory costs:
  | Object | Memory |
  |---|---|
  | Player Coordinates device | 3,500 |
  | Tag Zone | 1,500 |
  | Sentry (first placement) | 1,000 |
  | Ball (first placement) | 1,000 |
  | Sentry (subsequent) | 500 |
  | Block code (per block) | 500 |
  | Repeater | 500 |
  | Flag | 450 |
  | Movement Meter | 400 |
  | Wire | 10 |
  | Prop | 10 |
  | Floor terrain tile (top-down) | 2 |
  | Wall terrain tile (top-down) | 3 |
  | Platformer terrain tile | 3 |
 
### Scope
Scope controls *who* sees a state change. Three levels:
- **Player** — only the triggering player is affected (e.g. personal score counter)
- **Team** — everyone on the triggering player's team is affected
- **Global** — all players see the same change (e.g. shared barrier deactivation)
 
Always set scope intentionally. Wrong scope is a very common bug.
 
### Channels vs Wires
**Channels** — wireless, broadcast to all devices listening on the same channel name:
- No memory cost for the connection itself
- One sender can trigger unlimited receivers simultaneously
- Can't carry data, only signals
- Best for: long-distance connections, duplicated devices, fan-out triggers
 
**Wires** — physical connections between two specific devices:
- Cost 10 memory each
- Direct 1-to-1 (or 1-to-many with multiple wires)
- Visible during editing (can get cluttered)
- Best for: simple cause-effect between nearby devices, when you want explicit visual connections
 
**Rule of thumb:** Use channels for most things, wires for simple local connections or when you want the relationship to be obvious.
 
---
 
## Device Reference
 
### Communication Devices
 
#### Lifecycle
Fires events based on game state transitions.
- **Events:** Game Start, Game End, Player Join, Player Leave, Player Knocked Out
- Output: transmit on a channel when event fires
- **Common use:** trigger a Relay on "Game Start" to initialize everything
 
#### Relay
Repeats a channel message to a different audience (scope transformation).
- Receives on a channel, then re-broadcasts on another channel scoped to:
  - All Players
  - All Players on Team
  - Random Player
  - Random Player on Team
- **Common use:** Lifecycle fires "game_start" → Relay broadcasts "init" to all players individually → each player's devices initialize
 
---
 
### Overlay Devices
 
#### Property
Stores a persistent named value (number or text) accessible in block code.
- Options: \`Property Name\`, \`Property Type\` (number/text), \`Default Value\`, \`Scope\`
- **In blocks:** use \`get property "name"\` / \`set property "name" to [value]\`
- Max 128 properties per map
- **Common use:** player score tracking, flags/booleans, counters accessible across devices
 
#### Counter
Displays a count and fires events at target values.
- Options: \`Starting Value\`, \`Target Value\`, \`Increment Amount\`, \`Max/Min Value\`, \`Scope\`, \`Visible in-game\`
- Wire inputs: increment, decrement, reset
- Wire outputs: target value reached
- Channel: transmits when target reached
- **Common use:** kill counters, score trackers, wave systems, timers (combined with Repeater)
 
#### Game Overlay
Shows a persistent UI element to players.
- Types: \`Text\`, \`Button\`
- Can display block-code-driven dynamic text using \`set content [value]\` block
- Scope: player or global
- Wire input: show/hide
- **Common use:** HUD display, score display, instructions, custom buttons
 
#### Popup
Shows a temporary message dialog to a player.
- Options: header text, content text, close button text, call-to-action button
- Wire/channel: open popup, close popup
- **Common use:** instructions, cutscenes, quest text, rewards notifications
 
#### Waypoint
Shows a directional arrow/marker pointing to a location.
- Can point to a device or coordinates
- Show/hide via channel
 
---
 
### Objects
 
#### Button
A pressable object players can interact with.
- Options: \`Message\` (display text), \`Interaction Duration\`, \`Active on Start\`, \`Scope\`
- Wire output: button pressed
- Channel: transmit on press, activate/deactivate
- **Common use:** doors, purchases, quest starters, switches
 
#### Trigger
Invisible zone that fires on player collision OR when activated by wire/channel.
- Options: \`Trigger By Player Collision\` (yes/no), \`Trigger Delay\` (seconds), \`Visible in-game\`
- Wire inputs: trigger (activate it), deactivate, activate
- Wire outputs: triggered
- Block code: \`when triggered\` event
- **Common use:** invisible trip wires, delayed actions, loops with other triggers, area-based events
 
**Trigger loop pattern (efficient timer/loop):**
\`\`\`
Lifecycle (Game Start) → channel "start_loop"
Trigger A: receives "start_loop", triggers → channel "tick", delay = X seconds
Trigger B: receives "tick", triggers → channel "tick", delay = X seconds
(A and B keep bouncing the signal)
\`\`\`
> ⚠️ Each block of code in a Trigger costs 500 memory. Keep block code minimal.
 
#### Barrier
A visible or invisible blocking wall.
- Options: \`Color\`, \`Alpha\` (opacity), \`Active on Start\`, \`Width\`, \`Height\`, \`Scope\`, \`Collision\`
- Wire inputs: activate (make solid), deactivate (passthrough)
- **Common use:** doors, gates, invisible walls, arena boundaries, puzzle locks
 
#### Zone
Invisible area that detects players entering/leaving.
- Wire outputs: player enters, player leaves
- Options: \`Scope\`
- **Common use:** trigger events when players enter a region, area-of-effect triggers
 
#### Teleporter
Instantly moves players to another teleporter.
- Options: \`Group\` (teleports to teleporters in same group), \`Target Group\`
- Wire: trigger teleport
- **Common use:** fast travel, checkpoints, level transitions, portals
 
#### Spawn Pad
Sets where players spawn or respawn.
- Options: \`Team\`, \`Active on Start\`
- Wire: activate/deactivate
- **Common use:** team bases, respawn points, conditional spawn locations
 
#### Checkpoint
Saves a player's respawn position at that location.
- Wire: activate checkpoint for player
- **Common use:** platformer save points, maze progress
 
#### Sentry
An NPC enemy that attacks players.
- Options: \`Health\`, \`Gadget\`, \`Patrol Radius\`, \`Team\`, \`Active on Start\`
- First placement: 1,000 memory; subsequent: 500 memory
- Wire: activate, deactivate, knocked out output
- **Common use:** enemies, guards, boss battles, combat challenges
 
#### Item Granter
Gives or takes items from a player's inventory.
- Options: \`Item\`, \`Amount\` (positive to grant, negative to take), \`Scope\`
- Wire/channel input: grant item
- Block: device-specific \`grant item\` block
- **Common use:** rewards, shops (with Vending Machine), starting gear
 
#### Item Spawner
Spawns a pickup item in the world.
- Options: \`Item\`, \`Respawn Duration\`, \`Amount\`
- Wire: spawn item now
- **Common use:** weapon spawns, resource pickups, collectibles
 
#### Vending Machine
Lets players buy items/actions with in-game currency.
- Options: \`Item\`, \`Cost Item\`, \`Cost Amount\`, \`Grant Item\`, \`Grant Amount\`, \`Max Uses\`
- Wire output: purchase made
- **Common use:** shops, upgrade systems, gated progression
 
#### Questioner
Lets players answer Kit questions in-game.
- Wire/channel outputs: answered correctly, answered incorrectly
- Options: \`Requires Kit\`, \`Question Set\`
- Max 6 per map
- **Common use:** quiz challenges, gated doors (answer to proceed)
 
#### Counter (also in Objects section)
See Counter under Overlay Devices above.
 
#### Text / Text Billboard
Displays static or dynamic text in the world.
- Options: \`Text\`, \`Font Size\`, \`Color\`, \`Alpha\`
- Block code can update text dynamically with \`set text\` block
- **Common use:** labels, signs, scoreboards, debug displays
 
#### Repeater
Fires a signal repeatedly on an interval.
- Options: \`Interval\` (seconds), \`Max Repetitions\` (0 = infinite), \`Start on Game Start\`
- Wire/channel: start, stop, trigger output
- Max 10 per map — use Trigger loops as an alternative
- Memory: 500
- **Common use:** timers, wave spawners, periodic events, ambient effects
 
#### Wire Repeater
Passes a wire signal through, optionally with a delay.
- Options: \`Delay\` (seconds)
- Useful for chaining wire-based delays
- **Common use:** delayed wire reactions, timing sequences
 
#### Laser Beam / Laser Beam Manager
- Laser fires a continuous beam that damages players
- Laser Beam Manager controls multiple lasers
- Max 100 lasers
- Wire: activate/deactivate
 
#### Knockback Manager (Knockout Manager)
Tracks player knockouts and fires events.
- Wire output: player knocked out, knocked out by player
- Has 6 device-specific blocks (most of any device)
- **Common use:** kill tracking, kill-based rewards, spawn logic
 
#### Tag Zone
Creates a tagging mechanic (IT-style games).
- Max 6 per map — use carefully
- Memory: 1,500
- Options: \`Tagger Team\`, \`Tagged Team\`
 
#### Checker
Evaluates conditions and routes signals.
- Can check: property values, item counts, team membership
- Wire outputs: check passed, check failed
- **Common use:** conditional logic, gated events, if-then systems
 
#### Damager
Deals damage to a player.
- Options: \`Damage Amount\`, \`Scope\`
- Wire/channel input: deal damage
 
#### Health Granter
Restores health/shield to a player.
- Options: \`Health Amount\`, \`Shield Amount\`, \`Scope\`
- Wire/channel input: grant health
 
#### Speed Modifier
Changes a player's movement speed.
- Options: \`Speed Multiplier\`, \`Scope\`
- Wire/channel input: set speed
 
#### Team Switcher
Moves a player to a different team.
- Options: \`Target Team\`
- Wire input: switch team
 
#### Respawn
Respawns a knocked-out player.
- Wire/channel input: trigger respawn
 
#### End Game
Ends the game.
- Options: \`Win Team\`, \`Winning Condition\`
- Wire/channel input: end game
 
#### Player Coordinates
Tracks and broadcasts player X/Y position.
- Memory: 3,500 — use sparingly!
- Outputs coordinates as properties
 
#### Movement Meter
Tracks total distance a player moves.
- Memory: 400
 
---
 
### GimkitCopilot-Specific Device IDs
When using \`createGimbuild\` or \`listDevices\`, these are the exact \`deviceTypeId\` strings:
 
| Device Name | deviceTypeId |
|---|---|
| Button | \`button\` |
| Trigger | \`trigger\` |
| Counter | \`counter\` |
| Text / Text Billboard | \`textBillboard\` |
| Barrier | \`barrier\` |
| Zone | \`zone\` |
| Teleporter | \`teleporter\` |
| Spawn Pad | \`spawnPad\` |
| Checkpoint | \`checkpoint\` |
| Sentry | \`sentry\` |
| Item Granter | \`itemGranter\` |
| Item Spawner | \`itemSpawner\` |
| Vending Machine | \`vendingMachine\` |
| Questioner | \`questioner\` |
| Repeater | \`repeater\` |
| Wire Repeater | \`wireRepeater\` |
| Relay | \`relay\` |
| Lifecycle | \`lifecycle\` |
| Property | \`property\` |
| Game Overlay | \`overlay\` |
| Popup | \`popup\` |
| Waypoint | \`waypoint\` |
| Laser Beam | \`laser\` |
| Laser Beam Manager | \`laserManager\` |
| Knockout Manager | \`knockoutManager\` |
| Tag Zone | \`tagZone\` |
| Checker | \`checker\` |
| Damager | \`damager\` |
| Health Granter | \`healthGranter\` |
| Speed Modifier | \`speedModifier\` |
| Team Switcher | \`teamSwitcher\` |
| Respawn | \`respawn\` |
| End Game | \`endGame\` |
| Player Coordinates | \`playerCoordinates\` |
| Flag | \`flag\` |
| Flag Capture Zone | \`flagCaptureZone\` |
| Ball | \`ball\` |
| Ball Capture Zone | \`ballCaptureZone\` |
| Camera Point | \`cameraPoint\` |
| Camera View | \`cameraView\` |
| Crafting Table | \`craftingTable\` |
| Starting Inventory | \`startingInventory\` |
| Character (NPC) | \`character\` |
| Custom Shape | \`customShape\` |
 
---
 
## Common Device Option Keys
 
Most options are set as key-value pairs in the \`options\` object of \`createGimbuild\`.
 
\`\`\`jsonc
// Button
{ "message": "Press E", "interactionDuration": 0, "activeOnStart": true }
 
// Counter
{ "startingValue": 0, "targetValue": 10, "incrementAmount": 1,
  "scope": "player", "visibleInGame": true }
 
// Text Billboard
{ "text": "Hello World", "fontSize": 32, "color": "#FFFFFF", "alpha": 1 }
 
// Barrier
{ "color": "#FF0000", "alpha": 0.5, "activeOnStart": true,
  "width": 100, "height": 100, "scope": "global" }
 
// Trigger
{ "triggerByPlayerCollision": true, "triggerDelay": 0, "visibleInGame": false }
 
// Teleporter
{ "group": "portal_a", "targetGroup": "portal_b" }
 
// Item Granter
{ "itemId": "cash", "itemAmount": 100 }
 
// Sentry
{ "health": 100, "gadgetId": "blaster", "team": 2, "activeOnStart": true }
 
// Lifecycle
{ "eventType": "gameStart" }  // gameStart | gameEnd | playerJoin | playerLeave | playerKnockedOut
 
// Relay
{ "relayTo": "allPlayers" }  // allPlayers | allPlayersOnTeam | randomPlayer | randomPlayerOnTeam
 
// Repeater
{ "interval": 1, "maxRepetitions": 0, "startOnGameStart": false }
 
// Property
{ "propertyName": "score", "propertyType": "number", "defaultValue": 0, "scope": "player" }
 
// Spawn Pad
{ "teamNumber": 1, "activeOnStart": true }
\`\`\`
 
---
 
## Block Code
 
Block code is **visual programming** attached to Trigger, Knockout Manager, or other block-capable devices. It runs JavaScript-like logic without actual JS — the AI sends a JSON structure (\`codeGrids\`) alongside a device in \`createGimbuild\`.
 
### Block Code JSON Format
 
Each device can have a \`codeGrids\` array. Each entry defines one script attached to the device:
 
\`\`\`json
{
  "type": "deviceTrigger",       // when this script fires
  "channel": "my_channel",       // only for type "channel"
  "blocks": { ... }              // Blockly JSON structure
}
\`\`\`
 
**Trigger types:**
- \`"gameStart"\` — runs once when game begins
- \`"deviceTrigger"\` — runs when the Trigger device fires
- \`"channel"\` — runs when a specific channel is received (set \`channel\` field)
- \`"playerKnockedOut"\` — Knockout Manager only
 
### Blockly JSON Structure
 
The \`blocks\` field is Blockly JSON. Key pattern:
\`\`\`json
{
  "blocks": {
    "languageVersion": 0,
    "blocks": [
      {
        "type": "gkc_set_property",
        "inputs": {
          "PROPERTY": { "shadow": { "type": "text", "fields": { "TEXT": "score" } } },
          "VALUE":    { "shadow": { "type": "math_number", "fields": { "NUM": 0 } } }
        }
      }
    ]
  }
}
\`\`\`
 
### Key Block Types
 
| Block type | What it does |
|---|---|
| \`gkc_set_property\` | Set a Property device value |
| \`gkc_get_property\` | Read a Property device value |
| \`gkc_broadcast_message_on_channel\` | Broadcast on a channel |
| \`gkc_grant_item\` | Grant item to player |
| \`gkc_set_text\` | Set text on a Text Billboard |
| \`gkc_increment_counter\` | Increment a Counter |
| \`gkc_get_score\` | Get player's current score |
| \`controls_if\` | If/else logic |
| \`math_arithmetic\` | Math: add, subtract, multiply, divide |
| \`math_number\` | A literal number value |
| \`text\` | A literal text value |
| \`variables_set\` | Set a local variable |
| \`variables_get\` | Get a local variable |
| \`logic_compare\` | Compare two values (=, ≠, <, >, ≤, ≥) |
| \`logic_operation\` | AND / OR |
| \`logic_negate\` | NOT |
 
### Chaining Blocks (next field)
 
Blocks chain vertically via the \`next\` field:
\`\`\`json
{
  "type": "gkc_broadcast_message_on_channel",
  "inputs": { "CHANNEL": { "shadow": { "type": "text", "fields": { "TEXT": "door_open" } } } },
  "next": {
    "block": {
      "type": "gkc_set_property",
      "inputs": {
        "PROPERTY": { "shadow": { "type": "text", "fields": { "TEXT": "door_state" } } },
        "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 1 } } }
      }
    }
  }
}
\`\`\`
 
### Full Block Code Example — Toggle Door
 
Place a Trigger, and when triggered: if \`door_open\` property = 0, open door + set property to 1; else close + set to 0.
 
\`\`\`json
{
  "type": "trigger",
  "x": 0, "y": 0,
  "options": { "triggerByPlayerCollision": true },
  "codeGrids": [
    {
      "type": "deviceTrigger",
      "blocks": {
        "blocks": {
          "languageVersion": 0,
          "blocks": [{
            "type": "controls_if",
            "extraState": { "elseIfCount": 0, "elseCount": 1 },
            "inputs": {
              "IF0": { "block": {
                "type": "logic_compare",
                "fields": { "OP": "EQ" },
                "inputs": {
                  "A": { "block": { "type": "gkc_get_property", "inputs": { "PROPERTY": { "shadow": { "type": "text", "fields": { "TEXT": "door_open" }}}}}},
                  "B": { "block": { "type": "math_number", "fields": { "NUM": 0 }}}
                }
              }},
              "DO0": { "block": {
                "type": "gkc_broadcast_message_on_channel",
                "inputs": { "CHANNEL": { "shadow": { "type": "text", "fields": { "TEXT": "open_door" }}}},
                "next": { "block": {
                  "type": "gkc_set_property",
                  "inputs": {
                    "PROPERTY": { "shadow": { "type": "text", "fields": { "TEXT": "door_open" }}},
                    "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 1 }}}
                  }
                }}
              }},
              "ELSE": { "block": {
                "type": "gkc_broadcast_message_on_channel",
                "inputs": { "CHANNEL": { "shadow": { "type": "text", "fields": { "TEXT": "close_door" }}}},
                "next": { "block": {
                  "type": "gkc_set_property",
                  "inputs": {
                    "PROPERTY": { "shadow": { "type": "text", "fields": { "TEXT": "door_open" }}},
                    "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": 0 }}}
                  }
                }}
              }}
            }
          }]
        }
      }
    }
  ]
}
\`\`\`
 
### Memory Cost of Block Code
Each block inside a \`codeGrid\` costs **500 memory**. A 5-block script = 2,500 memory.
Keep block code minimal — prefer channel-based logic for simple cases.
 
---
 
## Design Patterns
 
### Timer System
\`\`\`
Lifecycle (gameStart) → channel "start_timer"
Trigger A: receives "start_timer", delay 1s, sends "tick"
Trigger B: receives "tick", delay 1s, sends "tick"
Counter: receives "tick", increments (shows elapsed seconds)
Counter: on target reached → channel "time_up"
\`\`\`
 
### Shop / Purchase System
\`\`\`
Vending Machine → wire "purchased" → Item Granter (grant reward)
Vending Machine → wire "purchased" → Counter (track purchases)
\`\`\`
 
### Door Lock (requires answer)
\`\`\`
Questioner → wire "answered correctly" → Barrier (deactivate)
Questioner → wire "answered incorrectly" → Popup (show "wrong answer")
\`\`\`
 
### Kill Counter / Reward
\`\`\`
Knockout Manager → wire "player knocked out" → Counter (scope: player)
Counter → wire "target reached" → Item Granter (grant reward)
\`\`\`
 
### Per-Player Initialization
\`\`\`
Lifecycle (gameStart) → channel "game_start"
Relay: receives "game_start", relayTo: allPlayers, sends "player_init"
Item Granter: receives "player_init" → grant starting items to each player
Speed Modifier: receives "player_init" → set each player's speed
\`\`\`
 
### Conditional Logic (Checker)
\`\`\`
Checker: condition = property "lives" > 0
→ check passed channel → continue game
→ check failed channel → End Game device
\`\`\`
 
### Toggle (on/off state)
\`\`\`
Property: name="door_open", type=number, default=0
Trigger: on player collision → block: if get property "door_open" == 0: broadcast "open_door", set property "door_open" to 1 / else: broadcast "close_door", set property "door_open" to 0
Barrier: receives "open_door" → deactivate; receives "close_door" → activate
\`\`\`
 
---
 
## Device Placement Limits (per map)
 
| Device | Limit |
|---|---|
| Tag Zone | 6 |
| Questioner | 6 |
| Repeater | 10 |
| Sentry | No hard limit (memory-bound) |
| Ball | 1 (first costs 1,000 mem) |
| Laser | 100 |
| Property | 128 |
| Starting Inventory | 64 |
| End Game | 16 |
| Prop | 5,000 |
| Custom Shape | 512 |
 
---
 
## Items Reference
 
**Gadgets (weapons):**
\`blaster\`, \`zapper\`, \`slingshot\`, \`evil-eye\`, \`quantum-portal\`, \`bopper\`, \`snowball-launcher\`, \`freeze-ray\`, \`wooden-wand\`, \`pebble-shooter\`, \`pickaxe\`, \`hammer\`
 
**Resources / Currency:**
\`cash\`, \`amber\`, \`energy\`, \`ore\`, \`wood\`, \`fish\`
 
**Consumables:**
\`medpack\`, \`shield-can\`
 
**Flags (for CTF):**
\`flag\` (use Flag device to spawn)
 
---
 
## Skill Search Tips (for skillSearch tool)
 
The \`skillSearch\` tool does keyword search over this skill document.
Use it when the GK skill is **not preloaded** (low-context mode) to look up specific sections on demand.
 
**Good queries:**
- Device name: \`"counter"\`, \`"trigger"\`, \`"sentry"\`, \`"relay"\`
- Concept: \`"scope"\`, \`"channels vs wires"\`, \`"memory costs"\`
- Pattern: \`"timer"\`, \`"shop"\`, \`"kill counter"\`, \`"initialization"\`
- Options: \`"counter options"\`, \`"barrier options"\`, \`"spawn pad"\`
 
**When to use skillSearch:**
- Skill preloading is OFF (low-context model) and you need device/pattern info
- You want a quick refresher on a specific section without re-reading the whole skill
- User asks a specific question you want to double-check
 
**When NOT to use skillSearch:**
- Skill preloading is ON — the full reference is already in your context
- You already know the answer from your context
 
---
 
## GimkitCopilot Build Tips
 
When building with \`createGimbuild\`:
 
1. **Always use \`buildType: "relative"\`** — positions are relative to the player, not absolute map coordinates.
 
2. **Channel naming convention:** Use descriptive names like \`"door_open"\`, \`"player_died"\`, \`"wave_2_start"\`. Never use generic names like \`"channel1"\`.
 
3. **Scope default:** When in doubt, default to \`"global"\` for barriers/doors, \`"player"\` for counters/inventory, \`"team"\` for team-based mechanics.
 
4. **Memory budget:** Before placing many sentries or triggers with block code, check remaining memory. A trigger with 5 blocks = 2,500 memory (500×5).
 
5. **Relay for initialization:** Always use \`Lifecycle → Relay (allPlayers)\` to initialize per-player state at game start. Without the Relay, the Lifecycle only fires for one player.
 
6. **Avoid Repeater when possible:** Max 10 per map. Use a Trigger loop instead for frequent events.
 
7. **Wire direction matters:** Wires carry signals FROM source TO target. Use \`{from, fromConnection, to, toConnection}\` with device \`id\` fields. The source fires the event, the target reacts.`

// ── Tool definitions ─────────────────────────────────────────────────────────
const ALL_TOOLS = [
  {
    name:'gkc_create_build',
    description:'Place devices on the Gimkit Creative map relative to the player. x/y = pixel offsets (positive=right/down). Call gkc_look_around first on an unfamiliar map.',
    inputSchema:{
      type:'object',required:['devices'],
      properties:{
        devices:{type:'array',items:{type:'object',required:['type'],properties:{
          id:{type:'string',description:'Short ID for wiring e.g. "btn1"'},
          type:{type:'string',description:'Device type e.g. "button","trigger","counter","textBillboard","barrier","sentry"'},
          options:{type:'object',description:'Option key-values — use gkc_get_device_info to discover keys'},
          x:{type:'number',description:'Pixels right from player (default 0)'},
          y:{type:'number',description:'Pixels down from player (default 0)'},
          depth:{type:'number'},codeGrids:{type:'array'}
        }}},
        wires:{type:'array',items:{type:'object',required:['from','fromConnection','to','toConnection'],properties:{
          from:{type:'string'},fromConnection:{type:'string',description:'e.g. "Button Pressed", "Triggered", "Target Value Reached"'},
          to:{type:'string'},toConnection:{type:'string',description:'e.g. "Increment Counter", "Activate Barrier"'}
        }}}
      }
    }
  },
  {name:'gkc_undo_last_build',description:'Remove the last batch of devices placed by gkc_create_build.',inputSchema:{type:'object',properties:{}}},
  {
    name:'gkc_get_map_devices',
    description:'Read all devices, terrain, and wires on the map with IDs and positions. Call before editing or deleting existing elements.',
    inputSchema:{type:'object',properties:{includeOptions:{type:'boolean'},includeWires:{type:'boolean'},areaFilter:{type:'object',properties:{centerX:{type:'number'},centerY:{type:'number'},radius:{type:'number'}}}}}
  },
  {
    name:'gkc_look_around',
    description:'Take a screenshot of the map area around the player. Call at the start of every build session.',
    inputSchema:{type:'object',properties:{radius:{type:'number',description:'View radius in game units (default 600)'},zoom:{type:'number',description:'0.5=wide, 1.0=normal, 2.0=close (default 0.8)'}}}
  },
  {
    name:'gkc_capture_screenshot',
    description:'Screenshot a specific world coordinate.',
    inputSchema:{type:'object',required:['centerX','centerY'],properties:{centerX:{type:'number'},centerY:{type:'number'},width:{type:'number'},height:{type:'number'},zoom:{type:'number'}}}
  },
  {
    name:'gkc_remove_elements',
    description:'Delete devices, terrain, wires, or custom assets by ID. Get IDs from gkc_get_map_devices first.',
    inputSchema:{type:'object',properties:{deviceIds:{type:'array',items:{type:'string'}},tilePositions:{type:'array',items:{type:'object',required:['x','y','depth'],properties:{x:{type:'number'},y:{type:'number'},depth:{type:'number'}}}},wireIds:{type:'array',items:{type:'string'}},customAssetIds:{type:'array',items:{type:'string'}}}}
  },
  {name:'gkc_vc_checkpoint',description:'Save a MapVersionControl snapshot. ALWAYS call before large destructive changes.',inputSchema:{type:'object',required:['message'],properties:{message:{type:'string'}}}},
  {
    name:'gkc_list_devices',
    description:'List Gimkit Creative device type IDs, optionally filtered by category.',
    inputSchema:{type:'object',properties:{category:{type:'string',enum:['starter','inventory','interaction','advanced','logic','combat','game','all']},search:{type:'string'}}}
  },
  {name:'gkc_search_terrain',description:'Find terrain type names by keyword. Omit query for full list.',inputSchema:{type:'object',properties:{query:{type:'string'}}}},
  {name:'gkc_search_props',description:'Find decorative prop names in Gimkit Creative.',inputSchema:{type:'object',properties:{query:{type:'string'},category:{type:'string',enum:['science','medieval','nature','furniture','sports','buildings','misc','all']}}}},
  {name:'gkc_get_device_info',description:'Get option keys and value types for a specific Gimkit device type. Always call this before placing an unfamiliar device.',inputSchema:{type:'object',required:['deviceType'],properties:{deviceType:{type:'string'}}}},
  {name:'gkc_skill_search',description:'Search the built-in Gimkit Creative reference for mechanics, patterns, memory costs, scope rules, and wire connections.',inputSchema:{type:'object',required:['query'],properties:{query:{type:'string'}}}},
  {name:'gkc_web_search',description:'Search the web for Gimkit Creative tutorials and ideas.',inputSchema:{type:'object',required:['query'],properties:{query:{type:'string'}}}},
  {
    name:'gkc_wiki_search',
    description:'Search gimkit.wiki — the official Gimkit Creative wiki — for device documentation, game mechanics, and feature pages. Use this for authoritative, up-to-date device information.',
    inputSchema:{
      type:'object',required:['query'],
      properties:{
        query:{type:'string',description:'Search terms e.g. "counter device", "sentry options", "relay scope"'},
        getPageContent:{type:'boolean',description:'If true, also return the full text of the top result page (default false)'},
        pageTitle:{type:'string',description:'Fetch a specific wiki page by exact title instead of searching'}
      }
    }
  },
]

const CLIENT_TOOLS = new Set([
  'gkc_create_build','gkc_undo_last_build','gkc_get_map_devices',
  'gkc_look_around','gkc_capture_screenshot','gkc_remove_elements','gkc_vc_checkpoint',
])

// ── Server tool: wiki search ─────────────────────────────────────────────────
async function runWikiSearch(args: Record<string,unknown>): Promise<unknown> {
  const WIKI = 'https://gimkit.wiki'
  const query    = (args.query    as string)||''
  const getPage  = (args.getPageContent as boolean)||false
  const pageTitle = (args.pageTitle as string)||''

  try {
    // If a specific page title is requested, fetch it directly
    if (pageTitle) {
      const url = `${WIKI}/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&explaintext=1&exsectionformat=plain&format=json&origin=*`
      const res = await fetch(url, {headers:{'User-Agent':'GimkitCopilotMCP/4.0'}})
      if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`)
      const data: {query?:{pages?:Record<string,{title?:string;extract?:string;missing?:string}>}} = await res.json()
      const pages = Object.values(data?.query?.pages||{})
      if (!pages.length || pages[0].missing !== undefined) return {error:`Page not found: ${pageTitle}`}
      const page = pages[0]
      return {
        title: page.title,
        url: `${WIKI}/wiki/${encodeURIComponent((page.title||'').replace(/ /g,'_'))}`,
        content: (page.extract||'').slice(0,4000),
        truncated: (page.extract||'').length > 4000
      }
    }

    // Search for pages
    const searchUrl = `${WIKI}/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6&srprop=snippet|titlesnippet&format=json&origin=*`
    const sRes = await fetch(searchUrl, {headers:{'User-Agent':'GimkitCopilotMCP/4.0'}})
    if (!sRes.ok) throw new Error(`Wiki search HTTP ${sRes.status}`)
    const sData: {query?:{search?:Array<{title:string;snippet:string;titlesnippet?:string}>}} = await sRes.json()
    const results = (sData?.query?.search||[]).map(r => ({
      title: r.title,
      url: `${WIKI}/wiki/${encodeURIComponent(r.title.replace(/ /g,'_'))}`,
      snippet: r.snippet.replace(/<[^>]+>/g,''),  // strip HTML tags from snippet
    }))

    if (!results.length) return {query, results:[], message:`No wiki pages found for "${query}".`}

    // Optionally fetch the content of the top result
    let topContent: string|null = null
    if (getPage && results[0]) {
      const pageUrl = `${WIKI}/api.php?action=query&titles=${encodeURIComponent(results[0].title)}&prop=extracts&explaintext=1&exsectionformat=plain&exintro=0&format=json&origin=*`
      const pRes = await fetch(pageUrl, {headers:{'User-Agent':'GimkitCopilotMCP/4.0'}})
      if (pRes.ok) {
        const pData: {query?:{pages?:Record<string,{extract?:string}>}} = await pRes.json()
        const pages = Object.values(pData?.query?.pages||{})
        if (pages[0]?.extract) topContent = pages[0].extract.slice(0,4000)
      }
    }

    return {
      query,
      results,
      count: results.length,
      ...(topContent ? {topPageContent: topContent, topPageTitle: results[0].title} : {})
    }
  } catch(e) {
    return {error: String(e), query}
  }
}

// ── Server tool: static lookups ───────────────────────────────────────────────
function runServerTool(name: string, args: Record<string,unknown>): unknown {
  switch (name) {
    case 'gkc_list_devices': {
      const cat  = (args.category as string)||'all'
      const srch = ((args.search   as string)||'').toLowerCase()
      let devs: string[] = []
      if (cat==='all') Object.values(DEVICE_CATS).forEach(c=>devs.push(...c))
      else devs = DEVICE_CATS[cat]||[]
      if (srch) devs = devs.filter(d=>d.toLowerCase().includes(srch))
      return {devices:devs,count:devs.length}
    }
    case 'gkc_search_terrain': {
      const q = ((args.query as string)||'').toLowerCase()
      const r = q ? TERRAIN.filter(t=>t.toLowerCase().includes(q)) : TERRAIN
      return {results:r,count:r.length}
    }
    case 'gkc_search_props': {
      const q   = ((args.query    as string)||'').toLowerCase()
      const cat = (args.category  as string)||'all'
      let props: string[] = []
      if (cat==='all') Object.values(PROPS).forEach(c=>props.push(...c))
      else props = PROPS[cat]||[]
      if (q) props = props.filter(p=>p.toLowerCase().includes(q))
      return {props,count:props.length}
    }
    case 'gkc_get_device_info': {
      const dt = args.deviceType as string
      let cat: string|null = null
      for (const [c,ds] of Object.entries(DEVICE_CATS)){if(ds.includes(dt)){cat=c;break}}
      return {deviceType:dt,category:cat,options:DEV_OPTS[dt]||'No documented options — try gkc_wiki_search for this device.'}
    }
    case 'gkc_skill_search': {
      const q = ((args.query as string)||'').toLowerCase()
      const lines = SKILL.split('\n').filter(l=>l.toLowerCase().includes(q.split(' ')[0]))
      return {query:args.query,lines:lines.slice(0,20)}
    }
    default: return {error:`Unknown server tool: ${name}`}
  }
}

async function runWebSearch(q: string): Promise<unknown> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q+' gimkit creative')}&format=json&no_html=1&skip_disambig=1`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: {AbstractText?:string;Heading?:string;AbstractURL?:string;RelatedTopics?:Array<{Text?:string;FirstURL?:string}>} = await res.json()
    const results: Array<{title:string;snippet:string;url:string}> = []
    if (data.AbstractText) results.push({title:data.Heading||'Summary',snippet:data.AbstractText,url:data.AbstractURL||''})
    ;(data.RelatedTopics||[]).slice(0,5).forEach(t=>{if(t.Text)results.push({title:t.Text.slice(0,60),snippet:t.Text,url:t.FirstURL||''})})
    return {results,count:results.length}
  } catch(e){return{error:String(e)}}
}

// ── Relay to browser plugin ───────────────────────────────────────────────────
async function relayToPlugin(sb: ReturnType<typeof createClient>, userId: string, name: string, args: Record<string,unknown>): Promise<unknown> {
  const {data,error} = await sb.from('tool_calls').insert({user_id:userId,name,args,status:'pending'}).select('id').single()
  if (error||!data) throw new Error(`DB insert failed: ${error?.message}`)
  const deadline = Date.now()+28_000
  while (Date.now()<deadline) {
    await new Promise(r=>setTimeout(r,400))
    const {data:row} = await sb.from('tool_calls').select('result,status').eq('id',data.id).maybeSingle()
    if (row?.status==='complete') return row.result
    if (row?.status==='error')    throw new Error((row.result as {error:string})?.error||'Tool execution error')
  }
  await sb.from('tool_calls').update({status:'error',result:{error:'Timeout — is GimkitCopilot open in Gimkit Creative and showing ● Connected?'},completed_at:new Date()}).eq('id',data.id)
  throw new Error('Plugin did not respond within 28s. Make sure GimkitCopilot is open in Gimkit Creative and shows ● Connected.')
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const ch = corsHeaders(origin)
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:ch})
  if (req.method!=='POST')    return new Response('Method not allowed',{status:405,headers:ch})

  let body: {jsonrpc?:string;id?:unknown;method?:string;params?:Record<string,unknown>}
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}),{status:400,headers:{'Content-Type':'application/json',...ch}})
  }
  const {id,method,params} = body
  const ok  = (r:unknown) => new Response(JSON.stringify({jsonrpc:'2.0',id,result:r}),{headers:{'Content-Type':'application/json',...ch}})
  const err = (c:number,m:string) => new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code:c,message:m}}),{headers:{'Content-Type':'application/json',...ch}})

  // Public — no auth required
  if (method==='initialize') return ok({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'gimkit-copilot',version:'4.0.0',description:'Control Gimkit Creative with your AI assistant. Requires a token from the GimkitCopilot plugin (Shift+X in Gimkit Creative).  '}})
  if (method==='notifications/initialized' || method==='ping') return ok({})

  // tools/list — public; filter disabled tools if token provided
  if (method==='tools/list') {
    const auth = (req.headers.get('authorization')||'').trim()
    let disabled: string[] = []
    if (auth.startsWith('Bearer ')) {
      try {
        const sb = createClient(SUPABASE_URL,SERVICE_KEY)
        const {data:{user}} = await sb.auth.getUser(auth.slice(7))
        if (user) {
          const {data:s} = await sb.from('user_settings').select('disabled_tools').eq('user_id',user.id).maybeSingle()
          disabled = (s?.disabled_tools as string[])||[]
        }
      } catch{}
    }
    return ok({tools: ALL_TOOLS.filter(t=>!disabled.includes(t.name))})
  }

  // tools/call — requires JWT
  if (method==='tools/call') {
    const auth = (req.headers.get('authorization')||'').trim()
    if (!auth.startsWith('Bearer ')) return err(-32001,'Missing Authorization header. Get your token from the GimkitCopilot plugin (Shift+X in Gimkit Creative).')
    const sb = createClient(SUPABASE_URL,SERVICE_KEY)
    const {data:{user},error:ae} = await sb.auth.getUser(auth.slice(7))
    if (ae||!user) return new Response(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32001,message:'Invalid or expired token. Re-open GimkitCopilot (Shift+X) and copy a fresh token.'}}),{status:401,headers:{'Content-Type':'application/json',...ch}})
    const name = (params?.name as string)||''
    const args = (params?.arguments as Record<string,unknown>)||{}
    const {data:s} = await sb.from('user_settings').select('disabled_tools').eq('user_id',user.id).maybeSingle()
    const disabled: string[] = (s?.disabled_tools as string[])||[]
    if (disabled.includes(name)) return err(-32002,`Tool "${name}" is disabled. Enable it in the GimkitCopilot plugin settings (Shift+X).`)
    try {
      let result: unknown
      if      (name==='gkc_web_search')  result = await runWebSearch(args.query as string)
      else if (name==='gkc_wiki_search') result = await runWikiSearch(args)
      else if (CLIENT_TOOLS.has(name))   result = await relayToPlugin(sb,user.id,name,args)
      else                               result = runServerTool(name,args)
      return ok({content:[{type:'text',text:typeof result==='string'?result:JSON.stringify(result,null,2)}]})
    } catch(e:unknown){
      return err(-32000, e instanceof Error ? e.message : String(e))
    }
  }

  return err(-32601,`Method not found: ${method}`)
})
*/
