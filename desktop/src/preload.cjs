const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('imagePipesDesktop', {
  isDesktop: true,
  platform: process.platform,
  openImages: () => ipcRenderer.invoke('desktop:openImages'),
  openFolder: () => ipcRenderer.invoke('desktop:openFolder'),
  pickFolder: () => ipcRenderer.invoke('desktop:pickFolder'),
  revealInFolder: (targetPath) => ipcRenderer.invoke('desktop:revealInFolder', targetPath),
})
