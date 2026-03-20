import { contextBridge, ipcRenderer } from 'electron'

const api = {
  invoke: <T>(channel: string, payload?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, payload)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]): void => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('octopus', api)
