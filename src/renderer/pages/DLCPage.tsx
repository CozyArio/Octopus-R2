import { useEffect, useMemo, useState } from 'react'
import { Puzzle, WandSparkles, SlidersHorizontal, Eye, EyeOff, RefreshCcw } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'
import type { DLCEntry, GameEntry } from '../../shared/types'

export default function DLCPage(): JSX.Element {
  const [games, setGames] = useState<GameEntry[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [dlcs, setDlcs] = useState<DLCEntry[]>([])
  const [showDisabled, setShowDisabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Load a game to manage its DLCs.')

  useEffect(() => {
    void loadGames()
  }, [])

  useEffect(() => {
    if (selectedAppId) {
      void loadDlcs(selectedAppId)
    } else {
      setDlcs([])
    }
  }, [selectedAppId])

  const selectedGame = useMemo(
    () => games.find((game) => game.appId === selectedAppId),
    [games, selectedAppId]
  )

  const enabledCount = useMemo(() => dlcs.filter((dlc) => dlc.enabled).length, [dlcs])
  const visibleDlcs = useMemo(
    () => (showDisabled ? dlcs : dlcs.filter((dlc) => dlc.enabled)),
    [dlcs, showDisabled]
  )

  const loadGames = async (): Promise<void> => {
    const result = await window.octopus.invoke<GameEntry[]>(CHANNELS.STEAM_GAMES)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setGames(result.data)
    if (result.data.length > 0) {
      setSelectedAppId(result.data[0].appId)
    }
  }

  const loadDlcs = async (appId: string): Promise<void> => {
    const result = await window.octopus.invoke<DLCEntry[]>(CHANNELS.DLC_LIST, { appId })
    if (!result.success) {
      setStatusMessage(result.error)
      setDlcs([])
      return
    }

    setDlcs(result.data)
    setStatusMessage(result.data.length > 0 ? `Loaded ${result.data.length} DLC entries.` : 'No DLC entries found in manifest.')
  }

  const toggleDlc = async (dlcId: string, enabled: boolean): Promise<void> => {
    const result = await window.octopus.invoke<Record<string, boolean>>(CHANNELS.DLC_TOGGLE, {
      appId: selectedAppId,
      dlcId,
      enabled
    })

    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setDlcs((current) => current.map((item) => (item.dlcId === dlcId ? { ...item, enabled } : item)))
    setStatusMessage(enabled ? `Enabled DLC ${dlcId}. Plugin updated.` : `Removed DLC ${dlcId}. Plugin updated.`)
  }

  const rebuildPluginNow = async (): Promise<void> => {
    if (!selectedAppId) {
      setStatusMessage('Pick a game first.')
      return
    }

    const result = await window.octopus.invoke<{ rebuilt: boolean }>(CHANNELS.DLC_REBUILD_PLUGIN, {
      appId: selectedAppId
    })

    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setStatusMessage(`Rebuilt SteamTools plugin for AppID ${selectedAppId}.`)
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">DLC Manager</h1>
          <p className="hero-subtitle">Real DLC entries from your imported Lua manifests</p>
        </div>
        <button className="btn-secondary animate-float-soft">
          <WandSparkles size={13} />
          Smart Presets
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-ctp-surface1/70 flex flex-col bg-ctp-mantle/75 backdrop-blur-xl">
          <div className="px-4 py-3 border-b border-ctp-surface1/60">
            <p className="panel-title">Your Games</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {games.length === 0 ? (
              <p className="text-xs text-ctp-subtext1 leading-relaxed p-2">
                No games in Library yet. Import manifests first.
              </p>
            ) : (
              games.map((game) => (
                <button
                  key={game.appId}
                  onClick={() => setSelectedAppId(game.appId)}
                  className={[
                    'w-full text-left rounded-xl border px-3 py-2.5 transition-colors',
                    selectedAppId === game.appId
                      ? 'border-ctp-mauve/50 bg-ctp-mauve/15'
                      : 'border-ctp-surface1/70 bg-ctp-surface0/55 hover:border-ctp-surface2'
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-ctp-text truncate">{game.name}</p>
                  <p className="text-[11px] text-ctp-subtext1 truncate">AppID: {game.appId}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
            <section className="glass-panel rounded-2xl p-4 animate-rise">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-ctp-mauve" />
                  <p className="panel-title">DLC Selection</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedGame && <span className="text-xs text-ctp-subtext1">{selectedGame.name}</span>}
                  <button
                    onClick={() => void rebuildPluginNow()}
                    className="btn-accent"
                    disabled={!selectedAppId}
                  >
                    <RefreshCcw size={13} />
                    Rebuild Plugin Now
                  </button>
                  <button
                    onClick={() => setShowDisabled((current) => !current)}
                    className="btn-secondary"
                  >
                    {showDisabled ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showDisabled ? 'Hide Removed' : 'Show Removed'}
                  </button>
                </div>
              </div>

              {selectedAppId ? (
                visibleDlcs.length > 0 ? (
                  <div className="space-y-2">
                    {visibleDlcs.map((dlc, index) => (
                      <div
                        key={dlc.dlcId}
                        className="rounded-xl border border-ctp-surface1/70 bg-ctp-surface0/50 px-3 py-2 flex items-center justify-between gap-3 animate-pop transition-transform duration-200 hover:-translate-y-0.5"
                        style={{ animationDelay: `${Math.min(index * 35, 180)}ms` }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-ctp-subtext0 truncate">{dlc.name}</p>
                          <p className="text-[11px] text-ctp-subtext1">ID: {dlc.dlcId}</p>
                        </div>
                        <button
                          onClick={() => void toggleDlc(dlc.dlcId, !dlc.enabled)}
                          className={[
                            'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                            dlc.enabled
                              ? 'bg-ctp-green/15 text-ctp-green border-ctp-green/30'
                              : 'bg-ctp-surface1 text-ctp-subtext0 border-ctp-surface2'
                          ].join(' ')}
                        >
                          {dlc.enabled ? 'Enabled' : 'Removed'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ctp-subtext1">
                    {dlcs.length > 0
                      ? 'All DLCs are currently removed from active list. Toggle "Show Removed" to view them.'
                      : 'No DLC entries were parsed for this game manifest.'}
                  </p>
                )
              ) : (
                <p className="text-sm text-ctp-subtext1">Pick a game from the left panel.</p>
              )}
            </section>

            <section className="glass-panel rounded-2xl p-4 animate-rise-delayed">
              <p className="panel-title">Summary</p>
              <div className="mt-3 space-y-2">
                <SummaryPill label={`Games: ${games.length}`} />
                <SummaryPill label={`DLCs: ${dlcs.length}`} />
                <SummaryPill label={`Enabled: ${enabledCount}`} />
              </div>
              <div className="mt-4 text-xs text-ctp-subtext1 leading-relaxed">
                {statusMessage}
              </div>
            </section>
          </div>

          {games.length === 0 && (
            <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center px-8 animate-rise">
              <div className="w-16 h-16 rounded-2xl bg-ctp-surface0 flex items-center justify-center">
                <Puzzle size={28} className="text-ctp-subtext0" />
              </div>
              <div>
                <p className="text-ctp-text font-semibold text-sm">No games available</p>
                <p className="text-ctp-subtext1 text-xs mt-1 max-w-xs leading-relaxed">
                  Import `.lua` manifests in Library first, then come back to manage real DLC entries.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryPill({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-ctp-surface1/70 bg-ctp-surface0/50 px-3 py-2 text-sm text-ctp-subtext0">
      {label}
    </div>
  )
}
