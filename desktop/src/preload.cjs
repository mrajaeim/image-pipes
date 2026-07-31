const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('imagePipesDesktop', {
  isDesktop: true,
  platform: process.platform,
})
