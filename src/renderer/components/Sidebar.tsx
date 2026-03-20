import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Library, Puzzle, Settings, Wrench, UserCircle2, Sparkles, MessageCircle, Palette } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'
import type { Settings as AppSettings } from '../../shared/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { to: '/library', label: 'Library', icon: <Library size={18} /> },
  { to: '/dlc', label: 'DLC Manager', icon: <Puzzle size={18} /> },
  { to: '/updates', label: 'Updates', icon: <Sparkles size={18} /> },
  { to: '/themes', label: 'Themes', icon: <Palette size={18} /> },
  { to: '/discord', label: 'Discord', icon: <MessageCircle size={18} /> }
]

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  [
    'group flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 select-none relative overflow-hidden',
    isActive
      ? 'bg-gradient-to-r from-ctp-surface1 to-ctp-surface0 text-ctp-text shadow-lg shadow-ctp-crust/20'
      : 'text-ctp-subtext0 hover:bg-ctp-surface0/85 hover:text-ctp-text hover:translate-x-0.5'
  ].join(' ')

export default function Sidebar(): JSX.Element {
  const [profileName, setProfileName] = useState('Guest')
  const [avatarPath, setAvatarPath] = useState<string | undefined>(undefined)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  const loadAvatar = async (): Promise<void> => {
    const result = await window.octopus.invoke<{ dataUrl: string | null }>(CHANNELS.SETTINGS_GET_AVATAR)
    if (result.success) {
      setAvatarSrc(result.data.dataUrl)
    }
  }

  useEffect(() => {
    const load = async (): Promise<void> => {
      const result = await window.octopus.invoke<AppSettings>(CHANNELS.SETTINGS_GET)
      if (result.success) {
        setProfileName(result.data.nickname.trim() || 'Guest')
        setAvatarPath(result.data.avatarPath)
      }
    }

    void load()
    void loadAvatar()

    const handler = (event: Event): void => {
      const customEvent = event as CustomEvent<AppSettings>
      if (customEvent.detail) {
        setProfileName(customEvent.detail.nickname.trim() || 'Guest')
        setAvatarPath(customEvent.detail.avatarPath)
        void loadAvatar()
      }
    }

    window.addEventListener('octopus:settings-updated', handler as EventListener)
    return () => window.removeEventListener('octopus:settings-updated', handler as EventListener)
  }, [])

  const initials = useMemo(
    () =>
      profileName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'G',
    [profileName]
  )

  return (
    <aside className="flex flex-col w-64 bg-ctp-mantle/75 backdrop-blur-xl border-r border-ctp-surface1/80 shrink-0 select-none">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ctp-surface1/70">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-ctp-mauve/35 to-ctp-blue/20 flex items-center justify-center shrink-0 border border-ctp-surface1/80">
          <span className="text-ctp-text text-xs font-black">O2</span>
        </div>
        <div>
          <p className="text-ctp-text font-black text-base leading-none tracking-tight">Octopus-R2</p>
          <p className="text-ctp-subtext1 text-[11px] mt-1">Manifest Control Center</p>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-ctp-surface1/70">
        <div className="rounded-2xl border border-ctp-surface1/75 bg-ctp-surface0/50 px-3 py-3 animate-rise">
          <div className="flex items-center gap-2">
            {avatarPath && avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile avatar"
                className="w-9 h-9 rounded-xl object-cover border border-ctp-surface1/70"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-ctp-blue/20 text-ctp-blue flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ctp-text truncate">{profileName}</p>
              <p className="text-[11px] text-ctp-subtext1 truncate">Account: Local Profile</p>
            </div>
            <UserCircle2 size={16} className="text-ctp-subtext0 shrink-0" />
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 panel-title">Navigation</p>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3 space-y-1 border-t border-ctp-surface1/70 pt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ctp-surface0/40">
          <Wrench size={13} className="text-ctp-subtext1 shrink-0" />
          <span className="text-xs text-ctp-subtext1 truncate">Tools ready</span>
        </div>
        <NavLink to="/settings" className={navLinkClass}>
          <Settings size={18} />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
