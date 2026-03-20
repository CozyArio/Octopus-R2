import type { IpcResult } from '../shared/types'

declare global {
  interface Window {
    octopus: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<IpcResult<T>>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
  }
}

export {}
