import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Palette, Puzzle, UserCircle2, CheckCircle2, DownloadCloud } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'
import type { Settings } from '../../shared/types'

const flavourClassNames = ['ctp-mocha', 'ctp-macchiato', 'ctp-frappe', 'ctp-latte', 'ctp-redline']

const defaultSettings: Settings = {
  steamPath: '',
  githubRepo: 'CozyArio/Octopus-R2',
  autoUpdateCheck: true,
  dlcTool: 'greenluma',
  nickname: '',
  catppuccinFlavour: 'mocha',
  isOwner: false
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [statusMessage, setStatusMessage] = useState('')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [])

  const saveDisabled = useMemo(() => !/^[^/]+\/[^/]+$/.test((settings.githubRepo || '').trim()), [settings.githubRepo])

  const applyFlavourClass = (flavour: Settings['catppuccinFlavour']): void => {
    const html = document.documentElement
    html.classList.remove(...flavourClassNames)
    html.classList.add(`ctp-${flavour}`)
  }

  const loadAvatar = async (): Promise<void> => {
    const result = await window.octopus.invoke<{ dataUrl: string | null }>(CHANNELS.SETTINGS_GET_AVATAR)
    if (result.success) {
      setAvatarSrc(result.data.dataUrl)
    }
  }

  const broadcastSettingsUpdate = (next: Settings): void => {
    window.dispatchEvent(new CustomEvent('octopus:settings-updated', { detail: next }))
  }

  const loadSettings = async (): Promise<void> => {
    const result = await window.octopus.invoke<Settings>(CHANNELS.SETTINGS_GET)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setSettings(result.data)
    applyFlavourClass(result.data.catppuccinFlavour)
    broadcastSettingsUpdate(result.data)
    await loadAvatar()
  }

  const detectSteamPath = async (): Promise<void> => {
    const result = await window.octopus.invoke<{ steamPath: string }>(CHANNELS.STEAM_DETECT_PATH)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setSettings((current) => ({ ...current, steamPath: result.data.steamPath }))
    setStatusMessage(`Detected Steam path: ${result.data.steamPath}`)
  }

  const saveSettings = async (): Promise<void> => {
    const payload: Partial<Settings> = {
      steamPath: settings.steamPath.trim(),
      githubRepo: settings.githubRepo.trim(),
      autoUpdateCheck: settings.autoUpdateCheck,
      nickname: settings.nickname.trim(),
      dlcTool: settings.dlcTool,
      catppuccinFlavour: settings.catppuccinFlavour
    }

    const result = await window.octopus.invoke<Settings>(CHANNELS.SETTINGS_SET, payload)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setSettings(result.data)
    applyFlavourClass(result.data.catppuccinFlavour)
    setStatusMessage('Settings saved.')
    broadcastSettingsUpdate(result.data)
  }

  const pickAvatar = async (): Promise<void> => {
    const result = await window.octopus.invoke<Settings>(CHANNELS.SETTINGS_PICK_AVATAR)
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setSettings(result.data)
    setStatusMessage('Avatar updated.')
    broadcastSettingsUpdate(result.data)
    await loadAvatar()
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <h1 className="hero-title">Settings</h1>
        <p className="hero-subtitle">Configure Octopus-R2</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <Section icon={<UserCircle2 size={15} />} title="Account">
          <div className="rounded-2xl border border-ctp-surface1/70 bg-ctp-mantle/70 p-4 flex items-center gap-3 animate-rise">
            {settings.avatarPath && avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Account avatar"
                className="w-10 h-10 rounded-xl object-cover border border-ctp-surface1/70"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-ctp-blue/20 text-ctp-blue flex items-center justify-center font-bold">
                {(settings.nickname.trim() || 'Guest').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ctp-text truncate">{settings.nickname.trim() || 'Guest'}</p>
              <p className="text-[11px] text-ctp-subtext1">Local account profile</p>
            </div>
            <button onClick={() => void pickAvatar()} className="btn-secondary">Upload Avatar</button>
            <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-ctp-green/10 text-ctp-green border border-ctp-green/20">
              <CheckCircle2 size={12} />
              Active
            </div>
          </div>
        </Section>

        <Section icon={<FolderOpen size={15} />} title="Steam">
          <Field label="Steam Path" hint="Auto-detected when possible">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="C:\\Program Files (x86)\\Steam"
                value={settings.steamPath}
                onChange={(e) => setSettings((current) => ({ ...current, steamPath: e.target.value }))}
                className="flex-1 bg-ctp-surface0 border border-ctp-surface1 rounded-lg px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-subtext0 outline-none focus:border-ctp-mauve/60 transition-colors"
              />
              <button
                onClick={() => void detectSteamPath()}
                className="px-3 py-2 rounded-lg border border-ctp-surface1 text-ctp-subtext0 text-xs font-semibold hover:border-ctp-surface2 hover:text-ctp-text transition-colors"
              >
                Detect
              </button>
            </div>
          </Field>
        </Section>

        <Section icon={<UserCircle2 size={15} />} title="Profile">
          <Field label="Nickname" hint="Displayed in the app account card">
            <input
              type="text"
              placeholder="Your display name"
              value={settings.nickname}
              onChange={(e) => setSettings((current) => ({ ...current, nickname: e.target.value }))}
              className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-lg px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-subtext0 outline-none focus:border-ctp-mauve/60 transition-colors"
            />
          </Field>
        </Section>

        <Section icon={<Puzzle size={15} />} title="DLC Tools">
          <Field label="Default Tool" hint="Config format written when you hit Apply">
            <div className="flex gap-2">
              <ToolChip
                label="GreenLuma"
                active={settings.dlcTool === 'greenluma'}
                onClick={() => setSettings((current) => ({ ...current, dlcTool: 'greenluma' }))}
              />
              <ToolChip
                label="CreamAPI"
                active={settings.dlcTool === 'creamapi'}
                onClick={() => setSettings((current) => ({ ...current, dlcTool: 'creamapi' }))}
              />
            </div>
          </Field>
        </Section>

        <Section icon={<Palette size={15} />} title="Appearance">
          <Field label="Catppuccin Flavour" hint="Changes the colour palette">
            <div className="flex gap-2 flex-wrap">
              {(['mocha', 'macchiato', 'frappe', 'latte', 'redline'] as const).map((flavour) => (
                <ToolChip
                  key={flavour}
                  label={flavour[0].toUpperCase() + flavour.slice(1)}
                  active={settings.catppuccinFlavour === flavour}
                  onClick={() => {
                    setSettings((current) => ({ ...current, catppuccinFlavour: flavour }))
                    applyFlavourClass(flavour)
                  }}
                />
              ))}
            </div>
          </Field>
        </Section>

        <Section icon={<DownloadCloud size={15} />} title="Updates">
          <Field label="GitHub Repo" hint="owner/repo, used to check latest release">
            <input
              type="text"
              placeholder="owner/repo"
              value={settings.githubRepo || ''}
              onChange={(e) => setSettings((current) => ({ ...current, githubRepo: e.target.value }))}
              className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-lg px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-subtext0 outline-none focus:border-ctp-mauve/60 transition-colors"
            />
          </Field>
          <Field label="Auto Update Check" hint="Check for updates automatically on app startup">
            <button
              onClick={() => setSettings((current) => ({ ...current, autoUpdateCheck: !current.autoUpdateCheck }))}
              className={[
                'px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
                settings.autoUpdateCheck
                  ? 'bg-ctp-green/15 text-ctp-green border-ctp-green/30'
                  : 'bg-ctp-surface0 text-ctp-subtext0 border-ctp-surface1'
              ].join(' ')}
            >
              {settings.autoUpdateCheck ? 'Enabled' : 'Disabled'}
            </button>
          </Field>
        </Section>

        <div className="flex items-center justify-between pt-2 pb-4">
          <p className="text-xs text-ctp-subtext1">{statusMessage}</p>
          <button
            disabled={saveDisabled}
            onClick={() => void saveSettings()}
            className={[
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              saveDisabled
                ? 'bg-ctp-surface1 text-ctp-subtext0 cursor-not-allowed'
                : 'bg-ctp-mauve text-ctp-base hover:bg-ctp-mauve/90'
            ].join(' ')}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-ctp-surface1/70 overflow-hidden glass-panel">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-ctp-mantle/70 border-b border-ctp-surface1/60">
        <span className="text-ctp-mauve">{icon}</span>
        <p className="panel-title">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-4 bg-ctp-base">{children}</div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-xs font-medium text-ctp-text">{label}</p>
        {hint && <p className="text-[11px] text-ctp-subtext1">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function ToolChip({
  label,
  active = false,
  onClick
}: {
  label: string
  active?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
        active
          ? 'bg-ctp-mauve/20 text-ctp-text border-ctp-mauve/40'
          : 'bg-ctp-surface0 text-ctp-subtext0 border-ctp-surface1 hover:border-ctp-surface2 hover:text-ctp-text'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
