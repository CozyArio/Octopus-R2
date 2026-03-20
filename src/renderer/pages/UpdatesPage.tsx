import { useEffect, useState } from 'react'
import { RefreshCw, DownloadCloud, FileText, History, Zap } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'

interface UpdateInfo {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  notes: string
  releaseUrl: string
}

const emptyInfo: UpdateInfo = {
  updateAvailable: false,
  currentVersion: '0.0.0',
  latestVersion: '0.0.0',
  notes: 'No changelog loaded yet.',
  releaseUrl: ''
}

export default function UpdatesPage(): JSX.Element {
  const [info, setInfo] = useState<UpdateInfo>(emptyInfo)
  const [status, setStatus] = useState('Checking for updates...')
  const [localChangelog, setLocalChangelog] = useState('Loading local changelog...')
  const [tab, setTab] = useState<'release' | 'local'>('release')

  useEffect(() => {
    void checkUpdates()
    void loadLocalChangelog()
  }, [])

  const checkUpdates = async (): Promise<void> => {
    setStatus('Checking GitHub releases...')
    const result = await window.octopus.invoke<UpdateInfo>(CHANNELS.APP_CHECK_UPDATES)
    if (!result.success) {
      setStatus(result.error)
      return
    }

    setInfo(result.data)
    setStatus(result.data.updateAvailable ? 'New update available.' : 'You are on the latest version.')
  }

  const openRelease = async (): Promise<void> => {
    if (!info.releaseUrl) return
    const result = await window.octopus.invoke<boolean>(CHANNELS.APP_OPEN_RELEASE, { url: info.releaseUrl })
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Current Version" value={info.currentVersion} />
          <StatCard label="Latest Version" value={info.latestVersion} />
          <StatCard label="Status" value={info.updateAvailable ? 'Update available' : 'Up to date'} />
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
            <button
              onClick={() => void openRelease()}
              disabled={!info.releaseUrl}
              className={[
                'btn-primary',
                !info.releaseUrl ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''
              ].join(' ')}
            >
              <DownloadCloud size={14} />
              Update
            </button>
          </div>
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
