import { useEffect, useMemo, useState } from 'react'
import { Library, RefreshCw, FolderOpen, Download, Trash2, Upload, Search, Sparkles, Globe2, Plus } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'
import type { GameEntry, Settings, WebCatalogGame } from '../../shared/types'

export default function LibraryPage(): JSX.Element {
  const [games, setGames] = useState<GameEntry[]>([])
  const [statusMessage, setStatusMessage] = useState('Ready.')
  const [search, setSearch] = useState('')
  const [onlyInstalled, setOnlyInstalled] = useState(false)
  const [catalogGames, setCatalogGames] = useState<WebCatalogGame[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogScanMinutes, setCatalogScanMinutes] = useState(5)

  useEffect(() => {
    void loadGames()
    void loadWebsiteCatalog()
    void loadScanSettings()
  }, [])

  useEffect(() => {
    if (catalogScanMinutes <= 0) return
    const timer = window.setInterval(() => {
      void loadWebsiteCatalog(true)
    }, catalogScanMinutes * 60 * 1000)

    return () => window.clearInterval(timer)
  }, [catalogScanMinutes, catalogGames])

  const installedCount = useMemo(() => games.filter((game) => game.installed).length, [games])
  const visibleGames = useMemo(() => {
    const query = search.trim().toLowerCase()
    return games.filter((game) => {
      if (onlyInstalled && !game.installed) return false
      if (!query) return true
      return (
        game.name.toLowerCase().includes(query) ||
        game.appId.toLowerCase().includes(query) ||
        game.luaPath.toLowerCase().includes(query)
      )
    })
  }, [games, onlyInstalled, search])
  const visibleCatalogGames = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()
    return catalogGames.filter((item) => {
      if (!query) return true
      return [item.gameName, item.appId, item.fileName].join(' ').toLowerCase().includes(query)
    })
  }, [catalogGames, catalogSearch])
  const libraryAppIds = useMemo(() => new Set(games.map((game) => game.appId)), [games])

  const loadGames = async (): Promise<void> => {
    const result = await window.octopus.invoke<GameEntry[]>(CHANNELS.STEAM_GAMES)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setGames(result.data)
  }

  const loadScanSettings = async (): Promise<void> => {
    const result = await window.octopus.invoke<Settings>(CHANNELS.SETTINGS_GET)
    if (result.success) {
      setCatalogScanMinutes(result.data.catalogScanMinutes)
    }
  }

  const loadWebsiteCatalog = async (silent = false): Promise<void> => {
    const previousIds = new Set(catalogGames.map((item) => item.appId))
    setCatalogLoading(true)
    const result = await window.octopus.invoke<WebCatalogGame[]>(CHANNELS.STEAM_WEB_CATALOG)
    if (!result.success) {
      setCatalogLoading(false)
      if (!silent) {
        setStatusMessage(result.error)
      }
      return
    }

    setCatalogGames(result.data)
    setCatalogLoading(false)
    if (silent) {
      const newItems = result.data.filter((item) => !previousIds.has(item.appId)).length
      if (newItems > 0) {
        setStatusMessage(`Website scan found ${newItems} new game(s).`)
      }
    } else {
      setStatusMessage(`Website catalog loaded (${result.data.length} games).`)
    }
  }

  const importLuaFiles = async (): Promise<void> => {
    const result = await window.octopus.invoke<{ games: GameEntry[]; imported: number }>(CHANNELS.STEAM_IMPORT_LUA)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setGames(result.data.games)
    setStatusMessage(result.data.imported > 0 ? `Imported ${result.data.imported} Lua file(s).` : 'No files selected.')
  }

  const scanLibrary = async (): Promise<void> => {
    const result = await window.octopus.invoke<GameEntry[]>(CHANNELS.STEAM_SCAN)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setGames(result.data)
    setStatusMessage(`Scan complete. ${result.data.length} game(s) in library.`)
  }

  const clearLibrary = async (): Promise<void> => {
    const result = await window.octopus.invoke<GameEntry[]>(CHANNELS.STEAM_CLEAR_LIBRARY)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setGames(result.data)
    setStatusMessage('Library cleared. Download/import manifests again.')
  }

  const addToSteamTools = async (appId: string): Promise<void> => {
    const result = await window.octopus.invoke<{ copied: number; targetDir: string }>(CHANNELS.STEAM_ADD_TOOLS, {
      appId
    })
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setStatusMessage(`Added to SteamTools: ${result.data.targetDir}`)
  }

  const addVisibleToSteamTools = async (): Promise<void> => {
    if (visibleGames.length === 0) {
      setStatusMessage('No visible games to add.')
      return
    }

    let success = 0
    for (const game of visibleGames) {
      const result = await window.octopus.invoke<{ copied: number; targetDir: string }>(CHANNELS.STEAM_ADD_TOOLS, {
        appId: game.appId
      })
      if (result.success) success += 1
    }

    setStatusMessage(`Added ${success}/${visibleGames.length} visible games to SteamTools.`)
  }

  const addGameFromWebsite = async (item: WebCatalogGame): Promise<void> => {
    const result = await window.octopus.invoke<{ games: GameEntry[]; imported: number }>(CHANNELS.STEAM_DOWNLOAD_LUA, {
      url: item.downloadUrl
    })
    if (!result.success) {
      setStatusMessage(`Failed to add ${item.gameName}: ${result.error}`)
      return
    }

    setGames(result.data.games)
    setStatusMessage(`Added ${item.gameName} from website catalog.`)
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">Game Library</h1>
          <p className="hero-subtitle">Download Lua manifests directly from your site</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void clearLibrary()} className="btn-secondary">
            <Trash2 size={13} />
            Clear Library
          </button>
          <button
            onClick={() => void importLuaFiles()}
            className="btn-secondary"
          >
            <Download size={13} />
            Import Local
          </button>
          <button
            onClick={() => void scanLibrary()}
            className="btn-primary"
          >
            <RefreshCw size={13} />
            Scan Library
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-ctp-surface1/50 shrink-0 glass-panel">
        <div className="flex items-center gap-3">
          <Chip label={`${games.length} games`} />
          <Chip label={`${visibleGames.length} visible`} />
          <Chip label={`${installedCount} installed`} color="green" />
          <Chip label={`${catalogGames.length} website`} />
        </div>
        <p className="text-xs text-ctp-subtext1">{statusMessage}</p>
      </div>

      <div className="px-6 py-3 border-b border-ctp-surface1/50 shrink-0">
        <div className="glass-panel rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ctp-subtext1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by game name, AppID, or path"
              className="input-base w-full pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOnlyInstalled((v) => !v)} className="btn-secondary">
              {onlyInstalled ? 'Show All' : 'Installed Only'}
            </button>
            <button onClick={() => void addVisibleToSteamTools()} className="btn-accent">
              <Sparkles size={13} />
              Add Visible to SteamTools
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-3 px-6 py-3 border-b border-ctp-surface1/50 shrink-0">
        <div className="glass-panel rounded-2xl p-4 space-y-3 animate-rise">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe2 size={14} className="text-ctp-blue" />
              <p className="panel-title">Website Catalog</p>
            </div>
            <button onClick={() => void loadWebsiteCatalog()} className="btn-secondary" disabled={catalogLoading}>
              <RefreshCw size={13} />
              {catalogLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <p className="text-[11px] text-ctp-subtext1">Auto scan every {catalogScanMinutes} minute(s).</p>

          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Search website games..."
            className="input-base w-full"
          />

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {visibleCatalogGames.slice(0, 100).map((item) => (
              <article
                key={item.appId}
                className="rounded-xl border border-ctp-surface1/80 bg-ctp-surface0/45 px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ctp-text truncate">{item.gameName}</p>
                  <p className="text-[11px] text-ctp-subtext1 truncate">AppID: {item.appId}</p>
                </div>
                <button
                  onClick={() => void addGameFromWebsite(item)}
                  disabled={libraryAppIds.has(item.appId)}
                  className={[
                    'btn-accent text-xs px-3 py-1.5',
                    libraryAppIds.has(item.appId) ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''
                  ].join(' ')}
                >
                  <Plus size={12} />
                  {libraryAppIds.has(item.appId) ? 'Added' : 'Add Game'}
                </button>
              </article>
            ))}
            {visibleCatalogGames.length === 0 && (
              <p className="text-xs text-ctp-subtext1">No website games matched your search.</p>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 space-y-2 animate-rise-delayed">
          <p className="panel-title">Import Local Backup</p>
          <p className="text-xs text-ctp-subtext1 leading-relaxed">
            Website Catalog is the default source. Use this only if you already have local `.lua` files.
          </p>
          <div className="flex justify-end">
            <button onClick={() => void importLuaFiles()} className="btn-secondary">
              <FolderOpen size={13} />
              Import Local Lua
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {visibleGames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8 animate-rise">
            <div className="w-16 h-16 rounded-2xl bg-ctp-surface0 flex items-center justify-center">
              <Library size={28} className="text-ctp-subtext0" />
            </div>
            <div>
              <p className="text-ctp-text font-semibold text-sm">No matching games</p>
              <p className="text-ctp-subtext1 text-xs mt-1 max-w-xs leading-relaxed">
                Try a different search/filter or import more manifests.
              </p>
            </div>
            <button
              onClick={() => void importLuaFiles()}
              className="btn-secondary"
            >
              <FolderOpen size={13} />
              Choose Lua files
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleGames.map((game, index) => (
              <article
                key={game.appId}
                className="rounded-2xl border border-ctp-surface1/80 bg-ctp-mantle/70 px-4 py-3 space-y-1.5 animate-rise hover:border-ctp-surface2 transition-all duration-200 hover:-translate-y-0.5"
                style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-ctp-text truncate">{game.name}</h2>
                  <span
                    className={[
                      'text-[10px] px-2 py-0.5 rounded-full border',
                      game.installed
                        ? 'bg-ctp-green/10 text-ctp-green border-ctp-green/20'
                        : 'bg-ctp-surface0 text-ctp-subtext0 border-ctp-surface1'
                    ].join(' ')}
                  >
                    {game.installed ? 'Installed' : 'Not installed'}
                  </span>
                </div>
                <p className="text-xs text-ctp-subtext1">AppID: {game.appId}</p>
                <p className="text-[11px] text-ctp-subtext1 truncate" title={game.luaPath}>
                  Lua: {game.luaPath}
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => void addToSteamTools(game.appId)}
                    className="btn-secondary"
                  >
                    <Upload size={12} />
                    Add to SteamTools
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, color = 'surface' }: { label: string; color?: 'green' | 'surface' }): JSX.Element {
  return (
    <span
      className={[
        'px-2.5 py-0.5 rounded-full text-[11px] font-medium border',
        color === 'green'
          ? 'bg-ctp-green/10 text-ctp-green border-ctp-green/20'
          : 'bg-ctp-surface0 text-ctp-subtext0 border-ctp-surface1'
      ].join(' ')}
    >
      {label}
    </span>
  )
}
