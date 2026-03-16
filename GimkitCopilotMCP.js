/*
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
