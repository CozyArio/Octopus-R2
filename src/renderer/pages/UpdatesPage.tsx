import { useEffect, useState } from 'react'
import { RefreshCw, DownloadCloud, FileText, History, Zap, Rocket } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'

interface UpdateInfo {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  notes: string
  releaseUrl: string
  canAutoUpdate: boolean
  downloaded?: boolean
}

const emptyInfo: UpdateInfo = {
  updateAvailable: false,
  currentVersion: '0.0.0',
  latestVersion: '0.0.0',
  notes: 'No changelog loaded yet.',
  releaseUrl: '',
  canAutoUpdate: false,
  downloaded: false
}

export default function UpdatesPage(): JSX.Element {
  const [info, setInfo] = useState<UpdateInfo>(emptyInfo)
  const [status, setStatus] = useState('Checking for updates...')
  const [localChangelog, setLocalChangelog] = useState('Loading local changelog...')
  const [tab, setTab] = useState<'release' | 'local'>('release')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    void checkUpdates()
    void loadLocalChangelog()

    const unsubProgress = window.octopus.on('app:update-download-progress', (payload: unknown) => {
      const data = payload as { percent?: number } | undefined
      const next = Math.max(0, Math.min(100, Number(data?.percent ?? 0)))
      setDownloadPercent(next)
      setIsDownloading(true)
      setStatus(`Downloading update... ${next.toFixed(1)}%`)
    })

    const unsubDownloaded = window.octopus.on('app:update-downloaded', (payload: unknown) => {
      const data = payload as { version?: string } | undefined
      setIsDownloading(false)
      setDownloadPercent(100)
      setInfo((current) => ({ ...current, downloaded: true }))
      setStatus(`Update ${data?.version ?? info.latestVersion} downloaded. Click Install & Restart.`)
    })

    const unsubError = window.octopus.on('app:update-error', (payload: unknown) => {
      const data = payload as { message?: string } | undefined
      setIsDownloading(false)
      setStatus(data?.message || 'Updater error occurred.')
    })

    return () => {
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const checkUpdates = async (): Promise<void> => {
    setStatus('Checking for updates...')
    const result = await window.octopus.invoke<UpdateInfo>(CHANNELS.APP_CHECK_UPDATES)
    if (!result.success) {
      setStatus(result.error)
      return
    }

    setInfo(result.data)
    setDownloadPercent(result.data.downloaded ? 100 : 0)
    setIsDownloading(false)
    setStatus(result.data.updateAvailable ? 'New update available.' : 'You are on the latest version.')
  }

  const openRelease = async (): Promise<void> => {
    if (!info.releaseUrl) return
    const result = await window.octopus.invoke<boolean>(CHANNELS.APP_OPEN_RELEASE, { url: info.releaseUrl })
    if (!result.success) {
      setStatus(result.error)
    }
  }

  const downloadUpdate = async (): Promise<void> => {
    setStatus('Starting update download...')
    setIsDownloading(true)
    const result = await window.octopus.invoke<{ started: boolean }>(CHANNELS.APP_DOWNLOAD_UPDATE)
    if (!result.success) {
      setIsDownloading(false)
      setStatus(result.error)
      return
    }
    setStatus('Downloading update...')
  }

  const installUpdate = async (): Promise<void> => {
    setStatus('Installing update and restarting app...')
    const result = await window.octopus.invoke<{ installing: boolean }>(CHANNELS.APP_INSTALL_UPDATE)
    if (!result.success) {
      setStatus(result.error)
    }
  }

  const loadLocalChangelog = async (): Promise<void> => {
    const result = await window.octopus.invoke<{ markdown: string }>(CHANNELS.APP_GET_CHANGELOG)
    if (!result.success) {
      setLocalChangelog(result.error)
      return
    }
    setLocalChangelog(result.data.markdown)
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">Updates</h1>
          <p className="hero-subtitle">GitHub release updates, fallback repo checks, and changelog</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-ctp-yellow/40 bg-ctp-yellow/10 px-2.5 py-1 text-[11px] text-ctp-yellow animate-pop">
            Live update channel enabled
          </div>
        </div>
        <button onClick={() => void checkUpdates()} className="btn-secondary">
          <RefreshCw size={14} />
          Check Now
        </button>
      </header>

      <div className="px-6 py-4 border-b border-ctp-surface1/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard label="Current Version" value={info.currentVersion} />
          <StatCard label="Latest Version" value={info.latestVersion} />
          <StatCard label="Status" value={info.updateAvailable ? 'Update available' : 'Up to date'} />
          <StatCard label="Delivery" value={info.canAutoUpdate ? 'Auto install' : 'GitHub manual'} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-rise">
          <button
            onClick={() => setTab('release')}
            className={[
              'rounded-2xl border px-4 py-3 text-left transition-all',
              tab === 'release'
                ? 'border-ctp-blue/50 bg-ctp-blue/10'
                : 'border-ctp-surface1/70 bg-ctp-surface0/35 hover:border-ctp-surface2'
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-ctp-blue" />
              <p className="panel-title">GitHub Release</p>
            </div>
            <p className="text-xs text-ctp-subtext1 mt-2">Live notes from latest GitHub release tag.</p>
          </button>
          <button
            onClick={() => setTab('local')}
            className={[
              'rounded-2xl border px-4 py-3 text-left transition-all',
              tab === 'local'
                ? 'border-ctp-mauve/50 bg-ctp-mauve/10'
                : 'border-ctp-surface1/70 bg-ctp-surface0/35 hover:border-ctp-surface2'
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <History size={14} className="text-ctp-mauve" />
              <p className="panel-title">Local Changelog</p>
            </div>
            <p className="text-xs text-ctp-subtext1 mt-2">Bundled `CHANGELOG.md` from this app version.</p>
          </button>
        </div>

        <div className="glass-panel rounded-2xl p-4 animate-rise">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-ctp-blue" />
              <p className="panel-title">{tab === 'release' ? 'Release Notes' : 'Local Changelog'}</p>
            </div>
            <div className="flex items-center gap-2">
              {info.canAutoUpdate ? (
                info.downloaded ? (
                  <button onClick={() => void installUpdate()} className="btn-primary">
                    <Rocket size={14} />
                    Install & Restart
                  </button>
                ) : (
                  <button
                    onClick={() => void downloadUpdate()}
                    disabled={!info.updateAvailable || isDownloading}
                    className={[
                      'btn-primary',
                      !info.updateAvailable || isDownloading ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''
                    ].join(' ')}
                  >
                    <DownloadCloud size={14} />
                    {isDownloading ? 'Downloading...' : 'Download Update'}
                  </button>
                )
              ) : (
                <button
                  onClick={() => void openRelease()}
                  disabled={!info.releaseUrl}
                  className={[
                    'btn-primary',
                    !info.releaseUrl ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''
                  ].join(' ')}
                >
                  <DownloadCloud size={14} />
                  Open GitHub
                </button>
              )}
            </div>
          </div>
          {isDownloading && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-ctp-surface0/70 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-ctp-blue to-ctp-mauve transition-all duration-300"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-ctp-subtext1">{downloadPercent.toFixed(1)}%</p>
            </div>
          )}
          <p className="text-sm text-ctp-subtext0 leading-relaxed whitespace-pre-wrap mt-3">
            {tab === 'release' ? info.notes : localChangelog}
          </p>
        </div>
        <p className="text-xs text-ctp-subtext1">{status}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="glass-panel rounded-2xl px-4 py-3 animate-rise">
      <p className="text-[11px] text-ctp-subtext1 uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ctp-text">{value}</p>
    </div>
  )
}
