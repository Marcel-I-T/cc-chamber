import { contextBridge, ipcRenderer } from 'electron';

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
    write: (sessionId, data) => ipcRenderer.invoke('pty:write', { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.invoke('pty:resize', { sessionId, cols, rows }),
    kill: (sessionId) => ipcRenderer.invoke('pty:kill', { sessionId }),
    onData: (sessionId, handler) => on(`pty:data:${sessionId}`, handler),
    onExit: (sessionId, handler) => on(`pty:exit:${sessionId}`, handler),
  },
  fs: {
    pickDirectory: () => ipcRenderer.invoke('fs:pickDirectory'),
    list: (dirPath) => ipcRenderer.invoke('fs:list', { dirPath }),
  },
  app: {
    homedir: () => ipcRenderer.invoke('app:homedir'),
    claudeBin: () => ipcRenderer.invoke('app:claudeBin'),
  },
  claude: {
    run: (opts) => ipcRenderer.invoke('claude:run', opts),
    readSession: (opts) => ipcRenderer.invoke('claude:readSession', opts),
  },
});
