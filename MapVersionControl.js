/**
 * @name MapVersionControl
 * @description Git-like version control for creative maps with commits, branches, stashing, and project management
 * @author Coderofpears
 * @version 1.0.0
 * @gamemode creative
 */

// plugins/MapVersionControl/src/index.ts
api.net.onLoad(() => {
  const STORAGE_PREFIX = "mapvc_";
  const CURRENT_PROJECT_KEY = `${STORAGE_PREFIX}current_project`;
  const PROJECTS_KEY = `${STORAGE_PREFIX}projects`;

  // GUI State
  let guiVisible = false;
  let guiContainer = null;
  let isDragging = false;
  let isResizing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let guiLeft = 0;
  let guiTop = 0;
  let guiWidth = 800;
  let guiHeight = 600;

  // Storage utilities
  const storage = {
    get(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      localStorage.removeItem(key);
    }
  };

  // Get current map state
  function getMap() {
    const { worldManager } = api.stores.phaser.scene;
    const devices = worldManager.devices.allDevices.map((device) => ({
      id: device.id,
      deviceTypeId: device.deviceOption.id,
      options: JSON.stringify(device.options).replace('"trackedItemId":null', '"trackedItemId":undefined'),
      x: device.x,
      y: device.y
    }));
    const wires = [...worldManager.wires.wires.values()].map((wire) => ({
      id: wire.id,
      startConnection: wire.startConnection,
      endConnection: wire.endConnection,
      startDeviceId: wire.startDeviceId,
      endDeviceId: wire.endDeviceId
    }));
    return {
      tiles: [...api.stores.world.terrain.tiles.values()],
      devices,
      wires,
      customAssets: [...api.stores.world.customAssets.customAssets.values()]
    };
  }

  // Apply map state
  function goToState(state) {
    const map = getMap();
    
    // Remove existing elements
    for (const device of map.devices) {
      api.net.send("REMOVE_DEVICE", { id: device.id });
    }
    for (const tile of map.tiles) {
      api.net.send("REMOVE_TERRAIN", {
        depth: tile.depth,
        x: tile.x,
        y: tile.y
      });
    }
    for (const wire of map.wires) {
      api.net.send("REMOVE_WIRE", { id: wire.id });
    }
    for (const customAsset of map.customAssets) {
      api.net.send("REMOVE_CUSTOM_ASSET", {
        id: customAsset.id
      });
    }

    // Add new elements
    for (const customAsset of state.customAssets) {
      const { data, ...rest } = customAsset;
      api.net.send("ADD_CUSTOM_ASSET", {
        data: JSON.stringify(data),
        ...rest
      });
    }
    for (const device of state.devices) {
      api.net.send("PLACE_DEVICE", {
        deviceTypeId: device.deviceTypeId,
        id: device.id,
        options: device.options,
        x: device.x,
        y: device.y
      });
    }
    for (const tile of state.tiles) {
      api.net.send("PLACE_TERRAIN", tile);
    }
    for (const wire of state.wires) {
      api.net.send("PLACE_WIRE", {
        endConnection: wire.endConnection,
        endDevice: wire.endDeviceId,
        startConnection: wire.startConnection,
        startDevice: wire.startDeviceId
      });
    }
  }

  // Project management
  function getProjects() {
    return storage.get(PROJECTS_KEY) || [];
  }

  function saveProjects(projects) {
    storage.set(PROJECTS_KEY, projects);
  }

  function getCurrentProject() {
    return storage.get(CURRENT_PROJECT_KEY);
  }

  function setCurrentProject(projectName) {
    storage.set(CURRENT_PROJECT_KEY, projectName);
  }

  function getProjectKey(projectName) {
    return `${STORAGE_PREFIX}project_${projectName}`;
  }

  function getProject(projectName) {
    return storage.get(getProjectKey(projectName)) || {
      name: projectName,
      currentBranch: "main",
      branches: {
        main: {
          name: "main",
          commits: [],
          head: null
        }
      },
      stash: []
    };
  }

  function saveProject(project) {
    storage.set(getProjectKey(project.name), project);
  }

  // Git-like operations
  function commit(message) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    const branch = project.branches[project.currentBranch];
    const map = getMap();
    
    const commitObj = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      message: message || "Untitled commit",
      timestamp: Date.now(),
      parent: branch.head,
      state: map
    };

    branch.commits.push(commitObj);
    branch.head = commitObj.id;
    
    saveProject(project);
    api.notification.success({ 
      message: `Committed: ${commitObj.message}` 
    });
  }

  function checkout(commitId) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    const branch = project.branches[project.currentBranch];
    const commitObj = branch.commits.find(c => c.id === commitId);
    
    if (!commitObj) {
      api.notification.error({ message: "Commit not found" });
      return;
    }

    goToState(commitObj.state);
    branch.head = commitObj.id;
    saveProject(project);
    api.notification.success({ 
      message: `Checked out: ${commitObj.message}` 
    });
  }

  function createBranch(branchName) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    
    if (project.branches[branchName]) {
      api.notification.error({ message: "Branch already exists" });
      return;
    }

    const currentBranch = project.branches[project.currentBranch];
    project.branches[branchName] = {
      name: branchName,
      commits: [...currentBranch.commits],
      head: currentBranch.head
    };
    
    saveProject(project);
    api.notification.success({ 
      message: `Created branch: ${branchName}` 
    });
  }

  function switchBranch(branchName) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    
    if (!project.branches[branchName]) {
      api.notification.error({ message: "Branch not found" });
      return;
    }

    project.currentBranch = branchName;
    const branch = project.branches[branchName];
    
    if (branch.head) {
      const headCommit = branch.commits.find(c => c.id === branch.head);
      if (headCommit) {
        goToState(headCommit.state);
      }
    }
    
    saveProject(project);
    api.notification.success({ 
      message: `Switched to branch: ${branchName}` 
    });
  }

  function stashSave(message) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    const map = getMap();
    
    const stashEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      message: message || "WIP",
      timestamp: Date.now(),
      state: map
    };

    project.stash.unshift(stashEntry);
    saveProject(project);
    api.notification.success({ 
      message: `Stashed: ${stashEntry.message}` 
    });
  }

  function stashPop() {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    
    if (project.stash.length === 0) {
      api.notification.error({ message: "No stash entries" });
      return;
    }

    const stashEntry = project.stash.shift();
    goToState(stashEntry.state);
    saveProject(project);
    api.notification.success({ 
      message: `Applied stash: ${stashEntry.message}` 
    });
    updateGUI();
  }

  function deleteStash(index) {
    const projectName = getCurrentProject();
    if (!projectName) {
      api.notification.error({ message: "No project selected" });
      return;
    }

    const project = getProject(projectName);
    
    if (index < 0 || index >= project.stash.length) {
      api.notification.error({ message: "Invalid stash index" });
      return;
    }

    const stashEntry = project.stash[index];
    project.stash.splice(index, 1);
    saveProject(project);
    api.notification.success({ 
      message: `Deleted stash: ${stashEntry.message}` 
    });
    updateGUI();
  }

  // Build visual git graph
  function buildGitGraph(commits, headId) {
    if (commits.length === 0) return '';

    // Build commit tree structure
    const commitMap = new Map();
    commits.forEach(commit => {
      commitMap.set(commit.id, {
        ...commit,
        children: []
      });
    });

    // Link parents to children
    commits.forEach(commit => {
      if (commit.parent && commitMap.has(commit.parent)) {
        commitMap.get(commit.parent).children.push(commit.id);
      }
    });

    // Generate graph HTML
    let graphHtml = '<div style="font-family: monospace; line-height: 2;">';
    
    const reversedCommits = [...commits].reverse();
    reversedCommits.forEach((commit, index) => {
      const isHead = commit.id === headId;
      const node = commitMap.get(commit.id);
      const hasChildren = node.children.length > 0;
      const hasParent = commit.parent !== null;
      
      // Build the graph line
      let line = '';
      
      // Vertical line from parent
      if (index > 0) {
        line += '<span style="color: #6366f1;">│</span> ';
      } else {
        line += '<span style="color: #6366f1;">│</span> ';
      }
      
      // Commit node
      if (isHead) {
        line += '<span style="color: #4ade80; font-weight: bold;">●</span> ';
      } else {
        line += '<span style="color: #6366f1;">●</span> ';
      }
      
      // Commit info
      const shortId = commit.id.substring(0, 7);
      const date = new Date(commit.timestamp).toLocaleString();
      line += `<span style="color: ${isHead ? '#4ade80' : '#e0e0e0'}; cursor: pointer;" class="vc-commit-graph" data-id="${commit.id}">`;
      line += `<strong>${commit.message}</strong>`;
      if (isHead) line += ' <span style="color: #4ade80;">(HEAD)</span>';
      line += `<br><span style="margin-left: 24px; color: #888; font-size: 11px;">${shortId} - ${date}</span>`;
      line += '</span>';
      
      graphHtml += `<div style="margin: 4px 0;">${line}</div>`;
      
      // Vertical line to next commit
      if (index < reversedCommits.length - 1) {
        graphHtml += '<div style="margin: 0;"><span style="color: #6366f1;">│</span></div>';
      }
    });
    
    graphHtml += '</div>';
    return graphHtml;
  }

  // GUI Creation
  function createGUI() {
    if (guiContainer) return;

    // Calculate initial position (center of screen)
    guiLeft = (window.innerWidth - guiWidth) / 2;
    guiTop = (window.innerHeight - guiHeight) / 2;

    guiContainer = document.createElement('div');
    guiContainer.id = 'mapvc-gui';
    guiContainer.style.cssText = `
      position: fixed;
      left: ${guiLeft}px;
      top: ${guiTop}px;
      width: ${guiWidth}px;
      height: ${guiHeight}px;
      background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
      border: 2px solid #4a4a6a;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e0e0e0;
      display: none;
      overflow: hidden;
      resize: none;
    `;

    const header = document.createElement('div');
    header.id = 'mapvc-header';
    header.style.cssText = `
      background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #4a4a6a;
      cursor: move;
      user-select: none;
    `;

    const title = document.createElement('h2');
    title.textContent = '🗂️ Map Version Control';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: white;
      pointer-events: none;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 20px;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = () => toggleGUI();

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.id = 'mapvc-content';
    content.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      height: calc(100% - 70px);
    `;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'mapvc-resize';
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 0%, transparent 50%, #6366f1 50%, #6366f1 100%);
      border-bottom-right-radius: 10px;
    `;

    guiContainer.appendChild(header);
    guiContainer.appendChild(content);
    guiContainer.appendChild(resizeHandle);
    document.body.appendChild(guiContainer);

    // Dragging functionality
    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn) return;
      isDragging = true;
      dragStartX = e.clientX - guiLeft;
      dragStartY = e.clientY - guiTop;
      guiContainer.style.cursor = 'grabbing';
    });

    // Resizing functionality
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        guiLeft = e.clientX - dragStartX;
        guiTop = e.clientY - dragStartY;
        
        // Keep within viewport
        guiLeft = Math.max(0, Math.min(guiLeft, window.innerWidth - guiWidth));
        guiTop = Math.max(0, Math.min(guiTop, window.innerHeight - 100));
        
        guiContainer.style.left = guiLeft + 'px';
        guiContainer.style.top = guiTop + 'px';
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;
        
        guiWidth = Math.max(600, guiWidth + deltaX);
        guiHeight = Math.max(400, guiHeight + deltaY);
        
        guiContainer.style.width = guiWidth + 'px';
        guiContainer.style.height = guiHeight + 'px';
        
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      guiContainer.style.cursor = '';
    });
  }

  function updateGUI() {
    if (!guiContainer) return;

    const content = document.getElementById('mapvc-content');
    if (!content) return;

    const projectName = getCurrentProject();
    const projects = getProjects();

    let html = '';

    // Project Selection
    html += `
      <div style="margin-bottom: 24px; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; color: #a0a0ff;">📁 Project</h3>
          <button id="vc-new-project" style="padding: 6px 12px; background: #6366f1; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 13px;">+ New</button>
        </div>
        <select id="vc-project-select" style="width: 100%; padding: 10px; background: #2a2a3e; border: 1px solid #4a4a6a; border-radius: 6px; color: #e0e0e0; font-size: 14px; cursor: pointer;">
          <option value="">-- Select Project --</option>
          ${projects.map(p => `<option value="${p}" ${p === projectName ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    `;

    if (projectName) {
      const project = getProject(projectName);
      const branch = project.branches[project.currentBranch];
      const branches = Object.keys(project.branches);

      // Current Status
      html += `
        <div style="margin-bottom: 24px; padding: 16px; background: rgba(100, 200, 100, 0.1); border-left: 4px solid #4ade80; border-radius: 8px;">
          <div style="font-size: 14px; line-height: 1.8;">
            <div><strong>Branch:</strong> ${project.currentBranch}</div>
            <div><strong>Commits:</strong> ${branch.commits.length}</div>
            <div><strong>Stashed:</strong> ${project.stash.length}</div>
          </div>
        </div>
      `;

      // Actions
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #a0a0ff;">⚡ Actions</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <button id="vc-commit" style="padding: 12px; background: #10b981; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">💾 Commit</button>
            <button id="vc-stash" style="padding: 12px; background: #f59e0b; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">📦 Stash</button>
            <button id="vc-new-branch" style="padding: 12px; background: #8b5cf6; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">🌿 New Branch</button>
            <button id="vc-delete-project" style="padding: 12px; background: #ef4444; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">🗑️ Delete Project</button>
          </div>
        </div>
      `;

      // Branch Selector
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #a0a0ff;">🌿 Branches</h3>
          <select id="vc-branch-select" style="width: 100%; padding: 10px; background: #2a2a3e; border: 1px solid #4a4a6a; border-radius: 6px; color: #e0e0e0; font-size: 14px; cursor: pointer;">
            ${branches.map(b => `<option value="${b}" ${b === project.currentBranch ? 'selected' : ''}>${b}${b === project.currentBranch ? ' (current)' : ''}</option>`).join('')}
          </select>
        </div>
      `;

      // Commits
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #a0a0ff;">📜 Commit Graph</h3>
          <div style="max-height: 300px; overflow-y: auto; background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px;">
      `;

      if (branch.commits.length === 0) {
        html += `<div style="padding: 20px; text-align: center; color: #888;">No commits yet</div>`;
      } else {
        html += buildGitGraph(branch.commits, branch.head);
      }

      html += `</div></div>`;

      // Stash
      if (project.stash.length > 0) {
        html += `
          <div>
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #a0a0ff;">📦 Stash</h3>
            <div style="max-height: 150px; overflow-y: auto; background: rgba(255, 255, 255, 0.03); border-radius: 8px; padding: 8px;">
        `;

        project.stash.forEach((stash, index) => {
          const date = new Date(stash.timestamp).toLocaleString();
          html += `
            <div style="padding: 12px; margin: 4px 0; background: rgba(255, 255, 255, 0.05); border-radius: 6px; border-left: 3px solid #f59e0b; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1; cursor: pointer;" class="vc-stash" data-index="${index}">
                <div style="font-weight: 500; color: #e0e0e0; margin-bottom: 4px;">${stash.message}</div>
                <div style="font-size: 12px; color: #888;">${date}</div>
              </div>
              <button class="vc-delete-stash" data-index="${index}" style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px; margin-left: 12px;">Delete</button>
            </div>
          `;
        });

        html += `</div></div>`;
      }
    } else {
      html += `
        <div style="padding: 40px; text-align: center; color: #888;">
          <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
          <div style="font-size: 16px;">No project selected</div>
          <div style="font-size: 14px; margin-top: 8px;">Create or select a project to get started</div>
        </div>
      `;
    }

    content.innerHTML = html;

    // Attach event listeners
    const projectSelect = document.getElementById('vc-project-select');
    if (projectSelect) {
      projectSelect.onchange = (e) => {
        const selected = e.target.value;
        if (selected) {
          setCurrentProject(selected);
          const proj = getProject(selected);
          const br = proj.branches[proj.currentBranch];
          if (br.head) {
            const headCommit = br.commits.find(c => c.id === br.head);
            if (headCommit) goToState(headCommit.state);
          }
          api.notification.success({ message: `Switched to: ${selected}` });
          updateGUI();
        }
      };
    }

    const newProjectBtn = document.getElementById('vc-new-project');
    if (newProjectBtn) {
      newProjectBtn.onclick = () => {
        const name = prompt("Enter project name:");
        if (!name) return;
        const projs = getProjects();
        if (projs.includes(name)) {
          api.notification.error({ message: "Project already exists" });
          return;
        }
        projs.push(name);
        saveProjects(projs);
        setCurrentProject(name);
        const proj = getProject(name);
        saveProject(proj);
        api.notification.success({ message: `Created project: ${name}` });
        updateGUI();
      };
    }

    const commitBtn = document.getElementById('vc-commit');
    if (commitBtn) {
      commitBtn.onclick = () => {
        const message = prompt("Commit message:");
        if (message !== null) {
          commit(message);
          updateGUI();
        }
      };
    }

    const stashBtn = document.getElementById('vc-stash');
    if (stashBtn) {
      stashBtn.onclick = () => {
        const message = prompt("Stash message (optional):");
        stashSave(message || undefined);
        updateGUI();
      };
    }

    const newBranchBtn = document.getElementById('vc-new-branch');
    if (newBranchBtn) {
      newBranchBtn.onclick = () => {
        const name = prompt("Enter branch name:");
        if (name) {
          createBranch(name);
          updateGUI();
        }
      };
    }

    const deleteProjectBtn = document.getElementById('vc-delete-project');
    if (deleteProjectBtn) {
      deleteProjectBtn.onclick = () => {
        const projName = getCurrentProject();
        if (!confirm(`Delete project "${projName}"? This cannot be undone.`)) return;
        const projs = getProjects();
        const updated = projs.filter(p => p !== projName);
        saveProjects(updated);
        storage.remove(getProjectKey(projName));
        storage.remove(CURRENT_PROJECT_KEY);
        api.notification.success({ message: `Deleted project: ${projName}` });
        updateGUI();
      };
    }

    const branchSelect = document.getElementById('vc-branch-select');
    if (branchSelect) {
      branchSelect.onchange = (e) => {
        switchBranch(e.target.value);
        updateGUI();
      };
    }

    // Commit clicks
    document.querySelectorAll('.vc-commit').forEach(el => {
      el.onclick = () => {
        checkout(el.dataset.id);
        updateGUI();
      };
    });

    // Git graph commit clicks
    document.querySelectorAll('.vc-commit-graph').forEach(el => {
      el.onclick = () => {
        checkout(el.dataset.id);
        updateGUI();
      };
    });

    // Stash clicks
    document.querySelectorAll('.vc-stash').forEach(el => {
      el.onclick = () => {
        stashPop();
        updateGUI();
      };
    });

    // Stash delete buttons
    document.querySelectorAll('.vc-delete-stash').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Delete this stash entry?')) {
          deleteStash(parseInt(el.dataset.index));
        }
      };
    });
  }

  function toggleGUI() {
    if (!guiContainer) createGUI();
    
    guiVisible = !guiVisible;
    guiContainer.style.display = guiVisible ? 'block' : 'none';
    
    if (guiVisible) {
      updateGUI();
    }
  }

  // Configurable hotkey for toggling GUI
  api.hotkeys.addConfigurableHotkey({
    category: "Map Version Control",
    title: "Toggle Version Control GUI",
    preventDefault: true,
    default: {
      key: "KeyB",
      shift: true
    }
  }, () => {
    toggleGUI();
  });

  // Initialize GUI
  createGUI();
});
