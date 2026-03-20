import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import Sidebar from './components/Sidebar'
import LibraryPage from './pages/LibraryPage'
import DLCPage from './pages/DLCPage'
import SettingsPage from './pages/SettingsPage'
import UpdatesPage from './pages/UpdatesPage'
import DiscordPage from './pages/DiscordPage'

interface UpdateNotice {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  notes: string
  releaseUrl: string
  canAutoUpdate: boolean
}

export default function App(): JSX.Element {
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null)

  useEffect(() => {
    const unsub = window.octopus.on('app:update-available', (payload: unknown) => {
      const notice = payload as UpdateNotice | undefined
      if (notice?.updateAvailable) {
        setUpdateNotice(notice)
      }
    })
    return () => unsub()
  }, [])

  const openUpdater = (): void => {
    window.location.hash = '/updates'
  }

  return (
    <div className="h-full p-4 bg-ctp-base text-ctp-text relative">
      <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-ctp-mauve/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-ctp-blue/15 blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-6 z-30">
        {updateNotice && (
          <div className="glass-panel rounded-2xl px-4 py-3 animate-pop flex items-center gap-3">
            <Sparkles size={14} className="text-ctp-yellow" />
            <div className="text-xs">
              <p className="text-ctp-text font-semibold">Update {updateNotice.latestVersion} available</p>
              <p className="text-ctp-subtext1">Current {updateNotice.currentVersion}</p>
            </div>
            <button onClick={() => openUpdater()} className="btn-primary text-xs px-3 py-1.5">
              Update Now
            </button>
            <button onClick={() => setUpdateNotice(null)} className="btn-secondary text-xs px-3 py-1.5">
              Dismiss
            </button>
          </div>
        )}
      </div>
      <div className="relative z-10 flex h-full rounded-3xl overflow-hidden border border-ctp-surface1/80 shadow-2xl shadow-ctp-crust/50 bg-ctp-base/70 backdrop-blur-md animate-rise">
        <Sidebar />
        <main className="flex-1 overflow-y-auto page-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/dlc" element={<DLCPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/discord" element={<DiscordPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
