import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import * as VDF from 'vdf-parser'
import ElectronStore = require('electron-store')
import { CHANNELS } from '../shared/ipc-channels'
import type { DLCEntry, FeedPost, GameEntry, IpcResult, Settings, StoreSchema, WebCatalogGame } from '../shared/types'

interface UpdateInfoPayload {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  notes: string
  releaseUrl: string
  canAutoUpdate: boolean
  downloaded?: boolean
}

let autoUpdaterConfigured = false
let downloadedUpdateVersion: string | null = null
const MANIFEST_SITE_BASE = 'https://manifestkitkat.netlify.app/'
const MANIFEST_CATALOG_URL = `${MANIFEST_SITE_BASE}data/catalog.json`

const store = new ElectronStore<StoreSchema>({
  defaults: {
    settings: {
      steamPath: '',
      githubRepo: 'CozyArio/Octopus-R2',
      autoUpdateCheck: true,
      dlcTool: 'greenluma',
      nickname: '',
      catppuccinFlavour: 'mocha',
      isOwner: false
    },
    games: [],
    dlcStates: {},
    feed: []
  }
})

const defaultSettings: Settings = {
  steamPath: '',
  githubRepo: 'CozyArio/Octopus-R2',
  autoUpdateCheck: true,
  dlcTool: 'greenluma',
  nickname: '',
  catppuccinFlavour: 'mocha',
  isOwner: false
}

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail<T>(error: string): IpcResult<T> {
  return { success: false, error }
}

function normalizeSettings(partial: Partial<Settings> | undefined): Settings {
  const merged: Settings = { ...defaultSettings, ...(partial ?? {}) }
  if (!merged.githubRepo || typeof merged.githubRepo !== 'string') {
    merged.githubRepo = defaultSettings.githubRepo
  }
  if (!merged.catppuccinFlavour) {
    merged.catppuccinFlavour = defaultSettings.catppuccinFlavour
  }
  if (!['greenluma', 'creamapi'].includes(merged.dlcTool)) {
    merged.dlcTool = defaultSettings.dlcTool
  }
  return merged
}

function hashOwnerKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function getImageMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

function validateSettingsPayload(next: Settings): string | null {
  if (!/^[^/]+\/[^/]+$/.test(next.githubRepo.trim())) {
    return 'GitHub repo must be in owner/repo format.'
  }

  return null
}

function detectSteamPath(): string {
  const candidatePaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam'
  ]

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return candidatePaths[0]
}

function getSteamPath(): string {
  const configured = store.get('settings').steamPath.trim()
  return configured || detectSteamPath()
}

function getSteamLibraryPaths(steamPath: string): string[] {
  const libraryPaths = new Set<string>()
  libraryPaths.add(steamPath)

  const libraryFoldersPath = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  if (!existsSync(libraryFoldersPath)) {
    return Array.from(libraryPaths)
  }

  try {
    const text = readFileSync(libraryFoldersPath, 'utf8')
    const parsed = VDF.parse<Record<string, unknown>>(text, { types: false, arrayify: true })
    const root = (parsed?.libraryfolders ?? parsed) as Record<string, unknown>

    for (const [key, value] of Object.entries(root)) {
      if (!/^\d+$/.test(key)) continue

      if (typeof value === 'string') {
        libraryPaths.add(value)
        continue
      }

      if (value && typeof value === 'object') {
        const candidate = (value as Record<string, unknown>).path
        if (typeof candidate === 'string' && candidate.trim()) {
          libraryPaths.add(candidate)
        }
      }
    }
  } catch {
    // Keep default path fallback if parsing fails.
  }

  return Array.from(libraryPaths)
}

function getInstalledState(appId: string, steamPath: string): { installed: boolean; installPath?: string } {
  const libraryPaths = getSteamLibraryPaths(steamPath)
  for (const libraryPath of libraryPaths) {
    const manifestPath = join(libraryPath, 'steamapps', `appmanifest_${appId}.acf`)
    if (existsSync(manifestPath)) {
      return { installed: true, installPath: join(libraryPath, 'steamapps') }
    }
  }

  return { installed: false, installPath: undefined }
}

function getNameFromFilename(luaPath: string): string {
  const raw = basename(luaPath, '.lua')
  const cleaned = raw
    .replace(/^\d+\s*[_-]\s*/g, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return cleaned || raw
}

function looksLikeHashName(name: string): boolean {
  return /^[a-f0-9]{24,}$/i.test(name.trim())
}

function sanitizeGameName(game: GameEntry): GameEntry {
  const filenameName = getNameFromFilename(game.luaPath)
  const currentName = game.name?.trim() ?? ''
  if (!currentName || looksLikeHashName(currentName)) {
    return { ...game, name: filenameName || `App ${game.appId}` }
  }

  return game
}

function parseLuaFile(luaPath: string, steamPath: string): GameEntry | null {
  if (!existsSync(luaPath)) {
    return null
  }

  const content = readFileSync(luaPath, 'utf8')
  const appIdMatch =
    content.match(/--\s*AppID:\s*(\d{3,})/i) ??
    content.match(/addappid\s*\(\s*(\d{3,})/i) ??
    content.match(/(?:app[\s_]*id|appid)\s*[:=]\s*["']?(\d{3,})/i) ??
    content.match(/\b(\d{4,})\b/)

  if (!appIdMatch?.[1]) {
    return null
  }

  const nameMatch =
    content.match(/--\s*(?:Name|Game|Title)\s*:\s*(.+)$/im) ??
    content.match(/(?:name|title|game[\s_]*name)\s*[:=]\s*["']([^"']+)["']/i)

  const appId = appIdMatch[1]
  const addedAt = statSync(luaPath).mtimeMs
  const installState = getInstalledState(appId, steamPath)
  const filenameName = getNameFromFilename(luaPath)
  const rawName = nameMatch?.[1]?.trim() || filenameName || `App ${appId}`
  const name = /^[a-f0-9]{32,}$/i.test(rawName) ? filenameName : rawName

  return {
    appId,
    name,
    installPath: installState.installPath,
    installed: installState.installed,
    addedAt,
    luaPath
  }
}

function parseDlcEntriesFromLua(luaPath: string, gameAppId: string): DLCEntry[] {
  if (!existsSync(luaPath)) {
    return []
  }

  const content = readFileSync(luaPath, 'utf8')
  const addAppIdRegex = /addappid\s*\(\s*(\d{3,})/gi
  const parsedIdsInOrder: string[] = []
  let match: RegExpExecArray | null = addAppIdRegex.exec(content)

  while (match) {
    parsedIdsInOrder.push(match[1])
    match = addAppIdRegex.exec(content)
  }

  const appIdFromComment = content.match(/--\s*AppID:\s*(\d{3,})/i)?.[1]
  const firstAddAppId = parsedIdsInOrder[0]

  // Exclude anything that could represent the base game id.
  const baseAppIdCandidates = new Set<string>(
    [gameAppId, appIdFromComment, firstAddAppId].filter((value): value is string => Boolean(value))
  )

  const dlcIds = new Set<string>()
  for (const id of parsedIdsInOrder) {
    if (!baseAppIdCandidates.has(id)) {
      dlcIds.add(id)
    }
  }

  const state = store.get('dlcStates')[gameAppId] ?? {}
  return Array.from(dlcIds)
    .sort((a, b) => Number(a) - Number(b))
    .map((dlcId) => ({
      dlcId,
      name: `DLC ${dlcId}`,
      enabled: state[dlcId] ?? true
    }))
}

function buildFilteredLuaContent(content: string, gameAppId: string, dlcState: Record<string, boolean>): string {
  const addAppIdRegex = /addappid\s*\(\s*(\d{3,})/gi
  const parsedIdsInOrder: string[] = []
  let match: RegExpExecArray | null = addAppIdRegex.exec(content)

  while (match) {
    parsedIdsInOrder.push(match[1])
    match = addAppIdRegex.exec(content)
  }

  const appIdFromComment = content.match(/--\s*AppID:\s*(\d{3,})/i)?.[1]
  const firstAddAppId = parsedIdsInOrder[0]
  const baseAppIdCandidates = new Set<string>(
    [gameAppId, appIdFromComment, firstAddAppId].filter((value): value is string => Boolean(value))
  )

  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const lineMatch = line.match(/addappid\s*\(\s*(\d{3,})/i)
      if (!lineMatch?.[1]) {
        return true
      }

      const id = lineMatch[1]
      if (baseAppIdCandidates.has(id)) {
        return true
      }

      return dlcState[id] ?? true
    })
    .join(newline)
}

function syncSteamToolsPluginForGame(game: GameEntry, appId: string, dlcState: Record<string, boolean>): void {
  const steamPath = getSteamPath()
  const targetDir = join(steamPath, 'config', 'stplug-in')
  mkdirSync(targetDir, { recursive: true })

  const sourceContent = readFileSync(game.luaPath, 'utf8')
  const filteredContent = buildFilteredLuaContent(sourceContent, appId, dlcState)
  const targetPath = join(targetDir, `${appId}.lua`)
  writeFileSync(targetPath, filteredContent, 'utf8')
}

function dedupeFeedPosts(posts: FeedPost[]): FeedPost[] {
  const byId = new Map<string, FeedPost>()
  for (const post of posts) {
    if (!byId.has(post.id)) {
      byId.set(post.id, post)
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
}

function broadcastToWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function getReleaseUrlFromRepo(repo: string): string {
  return `https://github.com/${repo.trim()}/releases/latest`
}

function configureAutoUpdaterEvents(repo: string): void {
  if (autoUpdaterConfigured) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    broadcastToWindows('app:update-available', {
      updateAvailable: true,
      currentVersion: app.getVersion(),
      latestVersion: info.version ?? app.getVersion(),
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : 'Update available.',
      releaseUrl: getReleaseUrlFromRepo(repo),
      canAutoUpdate: true,
      downloaded: downloadedUpdateVersion === info.version
    } satisfies UpdateInfoPayload)
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcastToWindows('app:update-download-progress', {
      percent: progress.percent ?? 0,
      transferred: progress.transferred ?? 0,
      total: progress.total ?? 0,
      bytesPerSecond: progress.bytesPerSecond ?? 0
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloadedUpdateVersion = info.version ?? app.getVersion()
    broadcastToWindows('app:update-downloaded', {
      version: downloadedUpdateVersion
    })
  })

  autoUpdater.on('error', (error) => {
    broadcastToWindows('app:update-error', {
      message: error?.message ?? 'Unknown auto-updater error.'
    })
  })

  autoUpdaterConfigured = true
}

function readLocalChangelog(): string {
  const candidates = [
    join(app.getAppPath(), 'CHANGELOG.md'),
    join(process.cwd(), 'CHANGELOG.md'),
    join(process.resourcesPath, 'CHANGELOG.md')
  ]

  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8')
    }
  }

  return 'No local changelog file found.'
}

function parseVersion(version: string): number[] {
  return version.replace(/^v/i, '').split('.').map((item) => Number(item.replace(/\D.*$/, '') || '0'))
}

function isVersionNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left > right) return true
    if (left < right) return false
  }
  return false
}

async function checkGithubUpdate(repo: string): Promise<UpdateInfoPayload> {
  const currentVersion = app.getVersion()
  const trimmedRepo = repo.trim()
  if (!/^[^/]+\/[^/]+$/.test(trimmedRepo)) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      notes: 'Invalid GitHub repo format. Use owner/repo.',
      releaseUrl: '',
      canAutoUpdate: false
    }
  }

  let releaseVersion: string | null = null
  let releaseNotes = ''
  let releaseUrl = `https://github.com/${trimmedRepo}/releases/latest`

  try {
    const releaseApiUrl = `https://api.github.com/repos/${trimmedRepo}/releases/latest`
    const response = await fetch(releaseApiUrl, {
      headers: { Accept: 'application/vnd.github+json' }
    })

    if (response.ok) {
      const data = (await response.json()) as {
        tag_name?: string
        body?: string
        html_url?: string
        name?: string
      }
      releaseVersion = (data.tag_name || data.name || '').replace(/^v/i, '') || null
      releaseNotes = data.body || ''
      releaseUrl = data.html_url || releaseUrl
    }
  } catch {
    // Ignore release API failures and continue with package fallback source.
  }

  let packageVersion: string | null = null
  let packageNotes = ''
  try {
    const packageUrl = `https://raw.githubusercontent.com/${trimmedRepo}/main/package.json`
    const packageRes = await fetch(packageUrl)
    if (packageRes.ok) {
      const pkg = (await packageRes.json()) as { version?: string }
      packageVersion = String(pkg.version ?? '').trim() || null
    }

    const changelogUrl = `https://raw.githubusercontent.com/${trimmedRepo}/main/CHANGELOG.md`
    const changelogRes = await fetch(changelogUrl)
    if (changelogRes.ok) {
      packageNotes = (await changelogRes.text()).slice(0, 4000)
    }
  } catch {
    // Ignore package/changelog failures and use whatever source is available.
  }

  const releaseIsNewerThanPackage =
    !!releaseVersion && (!packageVersion || isVersionNewer(releaseVersion, packageVersion))
  const chosenVersion = releaseIsNewerThanPackage
    ? releaseVersion!
    : (packageVersion ?? releaseVersion ?? currentVersion)

  const chosenNotes = releaseIsNewerThanPackage
    ? (releaseNotes || 'No changelog provided.')
    : (packageNotes || releaseNotes || 'No changelog provided.')

  const chosenUrl = releaseIsNewerThanPackage
    ? releaseUrl
    : `https://github.com/${trimmedRepo}/commits/main`

  return {
    updateAvailable: isVersionNewer(chosenVersion, currentVersion),
    currentVersion,
    latestVersion: chosenVersion,
    notes: chosenNotes,
    releaseUrl: chosenUrl,
    canAutoUpdate: false
  }
}

async function checkForUpdates(repo: string): Promise<UpdateInfoPayload> {
  if (!app.isPackaged) {
    return checkGithubUpdate(repo)
  }

  configureAutoUpdaterEvents(repo)
  const currentVersion = app.getVersion()

  try {
    const result = await autoUpdater.checkForUpdates()
    const updateInfo = result?.updateInfo
    if (!updateInfo) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        notes: 'No update metadata found.',
        releaseUrl: getReleaseUrlFromRepo(repo),
        canAutoUpdate: true,
        downloaded: false
      }
    }

    const latestVersion = updateInfo.version ?? currentVersion
    const releaseNotes =
      typeof updateInfo.releaseNotes === 'string'
        ? updateInfo.releaseNotes
        : Array.isArray(updateInfo.releaseNotes)
          ? updateInfo.releaseNotes.map((item) => item.note).join('\n\n')
          : 'No changelog provided.'
    const downloaded = downloadedUpdateVersion === latestVersion

    return {
      updateAvailable: isVersionNewer(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      notes: releaseNotes,
      releaseUrl: getReleaseUrlFromRepo(repo),
      canAutoUpdate: true,
      downloaded
    }
  } catch {
    // If native check fails (misconfigured feed), keep fallback check alive.
    return checkGithubUpdate(repo)
  }
}

function mergeGames(existingGames: GameEntry[], importedGames: GameEntry[]): GameEntry[] {
  const byAppId = new Map<string, GameEntry>()
  for (const game of existingGames) byAppId.set(game.appId, sanitizeGameName(game))
  for (const game of importedGames) byAppId.set(game.appId, sanitizeGameName(game))
  return Array.from(byAppId.values()).sort((a, b) => b.addedAt - a.addedAt)
}

async function downloadAndParseLuaFromUrl(urlText: string): Promise<GameEntry | null> {
  const trimmed = urlText.trim()
  if (!trimmed) return null

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return null
  }

  const fileName = decodeURIComponent(basename(parsedUrl.pathname))
  if (!fileName.toLowerCase().endsWith('.lua')) {
    return null
  }

  const response = await fetch(parsedUrl)
  if (!response.ok) {
    return null
  }

  const downloadsPath = app.getPath('downloads')
  const targetPath = join(downloadsPath, fileName)
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(targetPath, bytes)

  return parseLuaFile(targetPath, getSteamPath())
}

async function fetchWebCatalog(): Promise<WebCatalogGame[]> {
  const response = await fetch(MANIFEST_CATALOG_URL)
  if (!response.ok) {
    throw new Error(`Failed to load website catalog (${response.status}).`)
  }

  const payload = (await response.json()) as { items?: unknown[] }
  const items = Array.isArray(payload.items) ? payload.items : []

  const byAppId = new Map<string, WebCatalogGame>()
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const downloadPath = String(item.downloadPath ?? '').trim()
    const fileName = String(item.fileName ?? '').trim()
    if (!downloadPath && !fileName) continue

    const resolvedDownloadUrl = new URL(downloadPath || `files/${encodeURIComponent(fileName)}`, MANIFEST_SITE_BASE).toString()
    const appIdFromField = String(item.appId ?? '').trim()
    const appIdFromFile = fileName.match(/^(\d{3,})/)?.[1] ?? ''
    const appId = appIdFromField || appIdFromFile
    if (!appId) continue

    const gameName = String(item.gameName ?? '').trim() || getNameFromFilename(fileName || `${appId}.lua`)
    const nextEntry: WebCatalogGame = {
      appId,
      gameName,
      fileName: fileName || `${appId}_${gameName}.lua`,
      downloadUrl: resolvedDownloadUrl,
      updatedAt: String(item.updatedAt ?? ''),
      gameSize: String(item.gameSize ?? '').trim() || undefined,
      thumbnailUrl: String(item.thumbnailUrl ?? '').trim() || undefined
    }

    const existing = byAppId.get(appId)
    if (!existing || nextEntry.updatedAt > existing.updatedAt) {
      byAppId.set(appId, nextEntry)
    }
  }

  return Array.from(byAppId.values()).sort((a, b) => a.gameName.localeCompare(b.gameName))
}

function registerSteamHandlers(): void {
  ipcMain.handle(CHANNELS.STEAM_DETECT_PATH, (): IpcResult<{ steamPath: string }> => {
    const steamPath = detectSteamPath()
    const settings = store.get('settings')
    store.set('settings', { ...settings, steamPath })
    return ok({ steamPath })
  })

  ipcMain.handle(CHANNELS.STEAM_GAMES, (): IpcResult<GameEntry[]> => {
    const sanitized = store.get('games').map(sanitizeGameName)
    store.set('games', sanitized)
    return ok(sanitized)
  })

  ipcMain.handle(CHANNELS.STEAM_WEB_CATALOG, async (): Promise<IpcResult<WebCatalogGame[]>> => {
    try {
      return ok(await fetchWebCatalog())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch website catalog.'
      return fail(message)
    }
  })

  ipcMain.handle(CHANNELS.STEAM_SCAN, (): IpcResult<GameEntry[]> => {
    const steamPath = getSteamPath()
    const current = store.get('games')
    const rescanned = current
      .map((game) => {
        const parsed = parseLuaFile(game.luaPath, steamPath)
        if (parsed) return parsed
        const installState = getInstalledState(game.appId, steamPath)
        return sanitizeGameName({ ...game, installed: installState.installed, installPath: installState.installPath })
      })
      .sort((a, b) => b.addedAt - a.addedAt)

    store.set('games', rescanned)
    return ok(rescanned)
  })

  ipcMain.handle(
    CHANNELS.STEAM_IMPORT_LUA,
    async (): Promise<IpcResult<{ games: GameEntry[]; imported: number }>> => {
      const result = await dialog.showOpenDialog({
        title: 'Select SteamTools Lua Files',
        defaultPath: app.getPath('downloads'),
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Lua files', extensions: ['lua'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return ok({ games: store.get('games'), imported: 0 })
      }

      const steamPath = getSteamPath()
      const parsed = result.filePaths
        .map((luaPath) => parseLuaFile(luaPath, steamPath))
        .filter((game): game is GameEntry => game !== null)

      const merged = mergeGames(store.get('games'), parsed)
      store.set('games', merged)
      return ok({ games: merged, imported: parsed.length })
    }
  )

  ipcMain.handle(
    CHANNELS.STEAM_DOWNLOAD_LUA,
    async (_event, payload: { url?: string }): Promise<IpcResult<{ games: GameEntry[]; imported: number }>> => {
      const urlText = payload?.url?.trim() ?? ''
      if (!urlText) {
        return fail('Missing Lua file URL.')
      }

      const parsed = await downloadAndParseLuaFromUrl(urlText)
      if (!parsed) {
        return fail('Failed to download/parse Lua manifest from URL.')
      }

      const merged = mergeGames(store.get('games'), [parsed])
      store.set('games', merged)
      return ok({ games: merged, imported: 1 })
    }
  )

  ipcMain.handle(
    CHANNELS.STEAM_DOWNLOAD_LUA_BATCH,
    async (_event, payload: { urls?: string[] }): Promise<IpcResult<{ games: GameEntry[]; imported: number }>> => {
      const urls = payload?.urls ?? []
      if (urls.length === 0) {
        return fail('No URLs provided.')
      }

      const parsedGames: GameEntry[] = []
      for (const url of urls) {
        const parsed = await downloadAndParseLuaFromUrl(url)
        if (parsed) {
          parsedGames.push(parsed)
        }
      }

      const merged = mergeGames(store.get('games'), parsedGames)
      store.set('games', merged)
      return ok({ games: merged, imported: parsedGames.length })
    }
  )

  ipcMain.handle(CHANNELS.STEAM_CLEAR_LIBRARY, (): IpcResult<GameEntry[]> => {
    store.set('games', [])
    return ok([])
  })

  ipcMain.handle(
    CHANNELS.STEAM_ADD_TOOLS,
    (_event, payload: { appId?: string }): IpcResult<{ copied: number; targetDir: string }> => {
      const appId = payload?.appId?.trim() ?? ''
      if (!appId) {
        return fail('Missing appId.')
      }

      const game = store.get('games').find((item) => item.appId === appId)
      if (!game) {
        return fail('Game not found in library.')
      }

      if (!existsSync(game.luaPath)) {
        return fail('Lua file no longer exists on disk.')
      }

      const steamPath = getSteamPath()
      const targetDir = join(steamPath, 'config', 'stplug-in')
      const dlcState = store.get('dlcStates')[appId] ?? {}
      syncSteamToolsPluginForGame(game, appId, dlcState)

      return ok({ copied: 1, targetDir })
    }
  )
}

function registerDlcHandlers(): void {
  ipcMain.handle(CHANNELS.DLC_LIST, (_event, payload: { appId?: string }): IpcResult<DLCEntry[]> => {
    const appId = payload?.appId?.trim() ?? ''
    if (!appId) {
      return fail('Missing appId.')
    }

    const games = store.get('games')
    const game = games.find((item) => item.appId === appId)
    if (!game) {
      return fail('Game not found in library.')
    }

    return ok(parseDlcEntriesFromLua(game.luaPath, appId))
  })

  ipcMain.handle(
    CHANNELS.DLC_TOGGLE,
    (_event, payload: { appId?: string; dlcId?: string; enabled?: boolean }): IpcResult<Record<string, boolean>> => {
      const appId = payload?.appId?.trim() ?? ''
      const dlcId = payload?.dlcId?.trim() ?? ''
      if (!appId || !dlcId || typeof payload?.enabled !== 'boolean') {
        return fail('Invalid DLC toggle payload.')
      }

      const states = store.get('dlcStates')
      const currentGameStates = states[appId] ?? {}
      const nextGameStates = { ...currentGameStates, [dlcId]: payload.enabled }
      const nextStates = { ...states, [appId]: nextGameStates }
      store.set('dlcStates', nextStates)

      const game = store.get('games').find((item) => item.appId === appId)
      if (!game) {
        return fail('Game not found in library.')
      }
      if (!existsSync(game.luaPath)) {
        return fail('Lua file no longer exists on disk.')
      }

      try {
        syncSteamToolsPluginForGame(game, appId, nextGameStates)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update SteamTools plugin.'
        return fail(message)
      }

      return ok(nextGameStates)
    }
  )

  ipcMain.handle(
    CHANNELS.DLC_REBUILD_PLUGIN,
    (_event, payload: { appId?: string }): IpcResult<{ rebuilt: boolean }> => {
      const appId = payload?.appId?.trim() ?? ''
      if (!appId) {
        return fail('Missing appId.')
      }

      const game = store.get('games').find((item) => item.appId === appId)
      if (!game) {
        return fail('Game not found in library.')
      }
      if (!existsSync(game.luaPath)) {
        return fail('Lua file no longer exists on disk.')
      }

      const dlcState = store.get('dlcStates')[appId] ?? {}
      try {
        syncSteamToolsPluginForGame(game, appId, dlcState)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to rebuild SteamTools plugin.'
        return fail(message)
      }

      return ok({ rebuilt: true })
    }
  )
}

function registerIpcHandlers(): void {
  registerSteamHandlers()
  registerDlcHandlers()

  ipcMain.handle(
    CHANNELS.APP_CHECK_UPDATES,
    async (): Promise<IpcResult<UpdateInfoPayload>> => {
      const settings = store.get('settings')
      try {
        return ok(await checkForUpdates(settings.githubRepo))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown update error.'
        return fail(message)
      }
    }
  )

  ipcMain.handle(CHANNELS.APP_DOWNLOAD_UPDATE, async (): Promise<IpcResult<{ started: boolean }>> => {
    const settings = store.get('settings')
    if (!app.isPackaged) {
      return fail('Automatic download works in packaged builds only.')
    }

    try {
      configureAutoUpdaterEvents(settings.githubRepo)
      await autoUpdater.downloadUpdate()
      return ok({ started: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download update.'
      return fail(message)
    }
  })

  ipcMain.handle(CHANNELS.APP_INSTALL_UPDATE, (): IpcResult<{ installing: boolean }> => {
    if (!app.isPackaged) {
      return fail('Automatic install works in packaged builds only.')
    }
    if (!downloadedUpdateVersion) {
      return fail('No downloaded update is ready to install.')
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall()
    })
    return ok({ installing: true })
  })

  ipcMain.handle(CHANNELS.APP_OPEN_RELEASE, async (_event, payload: { url?: string }): Promise<IpcResult<boolean>> => {
    const url = payload?.url?.trim() ?? ''
    if (!url) return fail('Missing release URL.')

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return fail('Invalid release URL.')
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
      return fail('Only https://github.com release links are allowed.')
    }

    await shell.openExternal(url)
    return ok(true)
  })

  ipcMain.handle(CHANNELS.APP_GET_CHANGELOG, (): IpcResult<{ markdown: string }> => {
    return ok({ markdown: readLocalChangelog() })
  })

  ipcMain.handle(CHANNELS.FEED_GET, (): IpcResult<FeedPost[]> => {
    const deduped = dedupeFeedPosts(store.get('feed'))
    store.set('feed', deduped)
    return ok(deduped)
  })

  ipcMain.handle(CHANNELS.SETTINGS_GET, (): IpcResult<Settings> => {
    const settings = normalizeSettings(store.get('settings'))
    if (!settings.steamPath) {
      const detected = detectSteamPath()
      const next = { ...settings, steamPath: detected }
      store.set('settings', next)
      return ok(next)
    }

    store.set('settings', settings)
    return ok(settings)
  })

  ipcMain.handle(CHANNELS.SETTINGS_GET_AVATAR, (): IpcResult<{ dataUrl: string | null }> => {
    const avatarPath = store.get('settings').avatarPath
    if (!avatarPath || !existsSync(avatarPath)) {
      return ok({ dataUrl: null })
    }

    const bytes = readFileSync(avatarPath)
    const mime = getImageMimeType(avatarPath)
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
    return ok({ dataUrl })
  })

  ipcMain.handle(
    CHANNELS.SETTINGS_SET,
    (_event, payload: Partial<Settings>): IpcResult<Settings> => {
      const current = normalizeSettings(store.get('settings'))
      const next = normalizeSettings({
        ...current,
        ...payload
      })

      const validationError = validateSettingsPayload(next)
      if (validationError) {
        return fail(validationError)
      }

      store.set('settings', next)
      return ok(next)
    }
  )

  ipcMain.handle(CHANNELS.SETTINGS_PICK_AVATAR, async (): Promise<IpcResult<Settings>> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Avatar Image',
      defaultPath: app.getPath('pictures'),
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return ok(store.get('settings'))
    }

    const sourcePath = result.filePaths[0]
    const extension = sourcePath.split('.').pop()?.toLowerCase() ?? 'png'
    const avatarsDir = join(app.getPath('userData'), 'avatars')
    mkdirSync(avatarsDir, { recursive: true })

    const targetPath = join(avatarsDir, `profile.${extension}`)
    copyFileSync(sourcePath, targetPath)

    const current = store.get('settings')
    const next = { ...current, avatarPath: targetPath }
    store.set('settings', next)
    return ok(next)
  })

  ipcMain.handle(
    CHANNELS.SETTINGS_VERIFY_OWNER_KEY,
    (_event, payload: { key?: string }): IpcResult<{ verified: boolean; initialized: boolean }> => {
      const key = payload?.key?.trim() ?? ''
      if (key.length < 4) {
        return fail('Owner key must be at least 4 characters.')
      }

      const settings = store.get('settings')
      const hashed = hashOwnerKey(key)

      // First successful entry initializes owner key hash.
      if (!settings.ownerKeyHash) {
        const next = { ...settings, ownerKeyHash: hashed, isOwner: true }
        store.set('settings', next)
        return ok({ verified: true, initialized: true })
      }

      const verified = settings.ownerKeyHash === hashed
      const next = { ...settings, isOwner: verified }
      store.set('settings', next)
      return ok({ verified, initialized: false })
    }
  )

  ipcMain.handle(
    CHANNELS.FEED_POST,
    (_event, payload: { text?: string; imageBase64?: string }): IpcResult<FeedPost> => {
      const settings = store.get('settings')
      if (!settings.isOwner) {
        return fail('Owner mode required to post.')
      }

      const text = payload?.text?.trim() ?? ''
      if (!text) {
        return fail('Post text cannot be empty.')
      }

      const post: FeedPost = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        authorId: settings.nickname || 'Owner',
        text,
        createdAt: Date.now(),
        reactions: { up: 0, down: 0 }
      }

      const current = store.get('feed')
      store.set('feed', dedupeFeedPosts([post, ...current]))
      return ok(post)
    }
  )

  ipcMain.handle(CHANNELS.FEED_DELETE, (_event, payload: { postId?: string }): IpcResult<FeedPost[]> => {
    const settings = store.get('settings')
    if (!settings.isOwner) {
      return fail('Owner mode required to delete posts.')
    }

    const postId = payload?.postId?.trim() ?? ''
    if (!postId) {
      return fail('Missing postId.')
    }

    const current = store.get('feed')
    const next = current.filter((post) => post.id !== postId)
    if (next.length === current.length) {
      return fail('Post not found.')
    }

    store.set('feed', next)
    return ok(next)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.on('did-finish-load', async () => {
    const settings = store.get('settings')
    if (!settings.autoUpdateCheck) return

    try {
      const result = await checkForUpdates(settings.githubRepo)
      if (result.updateAvailable) {
        win.webContents.send('app:update-available', result)
      }
    } catch {
      // Silent failure for renderer notification.
    }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  const settings = store.get('settings')
  if (settings.autoUpdateCheck) {
    setTimeout(async () => {
      try {
        await checkForUpdates(settings.githubRepo)
      } catch {
        // Silent failure for background update check.
      }
    }, 1200)

    // Re-check in background while app is open.
    setInterval(async () => {
      try {
        const result = await checkForUpdates(settings.githubRepo)
        if (!result.updateAvailable) return
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('app:update-available', result)
        }
      } catch {
        // Ignore periodic check failures.
      }
    }, 3 * 60 * 60 * 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
