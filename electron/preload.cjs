// CommonJS preload. Loads reliably inside the asar bundle on Electron 42.
// Same surface as the old preload.mjs.
const { contextBridge, ipcRenderer } = require('electron');

const subs = new Map();

function on(channel, handler) {
  const wrapped = (_e, payload) => handler(payload);
  ipcRenderer.on(channel, wrapped);
  subs.set(handler, { channel, wrapped });
  return () => {
    ipcRenderer.off(channel, wrapped);
    subs.delete(handler);
  };
}

contextBridge.exposeInMainWorld('api', {
  pty: {
    spawn: (opts) => ipcRenderer.invoke('pty:spawn', opts),
    attach: (sessionId) => ipcRenderer.invoke('pty:attach', { sessionId }),
    write: (sessionId, data) => ipcRenderer.invoke('pty:write', { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.invoke('pty:resize', { sessionId, cols, rows }),
    kill: (sessionId) => ipcRenderer.invoke('pty:kill', { sessionId }),
    onData: (sessionId, handler) => on(`pty:data:${sessionId}`, handler),
    onExit: (sessionId, handler) => on(`pty:exit:${sessionId}`, handler),
  },
  fs: {
    pickDirectory: () => ipcRenderer.invoke('fs:pickDirectory'),
    pickFiles: (opts) => ipcRenderer.invoke('fs:pickFiles', opts),
    list: (dirPath) => ipcRenderer.invoke('fs:list', { dirPath }),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
  },
  app: {
    homedir: () => ipcRenderer.invoke('app:homedir'),
    claudeBin: () => ipcRenderer.invoke('app:claudeBin'),
  },
  claude: {
    run: (opts) => ipcRenderer.invoke('claude:run', opts),
    readSession: (opts) => ipcRenderer.invoke('claude:readSession', opts),
    listSessions: (opts) => ipcRenderer.invoke('claude:listSessions', opts),
  },
});
