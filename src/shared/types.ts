export type IpcResult<T> = { success: true; data: T } | { success: false; error: string }

export interface GameEntry {
  appId: string
  name: string
  installPath?: string
  installed: boolean
  addedAt: number
  luaPath: string
}

export interface WebCatalogGame {
  appId: string
  gameName: string
  fileName: string
  downloadUrl: string
  updatedAt: string
  gameSize?: string
  thumbnailUrl?: string
}

export interface DLCEntry {
  dlcId: string
  name: string
  enabled: boolean
}

export interface FeedPost {
  id: string
  authorId: string
  text: string
  imagePath?: string
  createdAt: number
  reactions: { up: number; down: number }
}

export interface Settings {
  steamPath: string
  githubRepo: string
  autoUpdateCheck: boolean
  dlcTool: 'greenluma' | 'creamapi'
  nickname: string
  avatarPath?: string
  catppuccinFlavour: 'mocha' | 'macchiato' | 'frappe' | 'latte' | 'redline'
  isOwner: boolean
  ownerKeyHash?: string
}

export interface StoreSchema {
  settings: Settings
  games: GameEntry[]
  dlcStates: Record<string, Record<string, boolean>>
  feed: FeedPost[]
}
