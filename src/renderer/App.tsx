import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import LibraryPage from './pages/LibraryPage'
import DLCPage from './pages/DLCPage'
import SettingsPage from './pages/SettingsPage'
import UpdatesPage from './pages/UpdatesPage'

export default function App(): JSX.Element {
  return (
    <div className="h-full p-4 bg-ctp-base text-ctp-text relative">
      <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-ctp-mauve/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-ctp-blue/15 blur-3xl pointer-events-none" />
      <div className="relative z-10 flex h-full rounded-3xl overflow-hidden border border-ctp-surface1/80 shadow-2xl shadow-ctp-crust/50 bg-ctp-base/70 backdrop-blur-md">
        <Sidebar />
        <main className="flex-1 overflow-y-auto page-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/dlc" element={<DLCPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
