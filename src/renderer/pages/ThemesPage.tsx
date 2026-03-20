import { useMemo, useState } from 'react'
import { Palette, Save, Copy, Download, Upload, CheckCircle2, Brush } from 'lucide-react'
import {
  EDITABLE_THEME_VARS,
  applyThemeVars,
  buildHexFromComputedStyle,
  buildThemeVarsFromHex,
  clearThemeVars,
  getActiveThemeId,
  readThemes,
  setActiveThemeId as persistActiveThemeId,
  type CustomTheme,
  writeThemes
} from '../utils/theme-manager'

export default function ThemesPage(): JSX.Element {
  const [themes, setThemes] = useState<CustomTheme[]>(() => readThemes())
  const [activeThemeId, setActiveThemeIdState] = useState<string | null>(() => getActiveThemeId())
  const [themeName, setThemeName] = useState('My Theme')
  const [editorHexByKey, setEditorHexByKey] = useState<Record<string, string>>(() => buildHexFromComputedStyle())
  const [importJson, setImportJson] = useState('')
  const [status, setStatus] = useState('Create, save, and share your own themes.')

  const fallbackHexByKey = useMemo(
    () => Object.fromEntries(EDITABLE_THEME_VARS.map((item) => [item.key, item.fallbackHex])),
    []
  )

  const applyCurrentEditor = (): void => {
    const vars = buildThemeVarsFromHex(editorHexByKey, fallbackHexByKey)
    applyThemeVars(vars)
    setStatus('Theme preview applied.')
  }

  const saveTheme = (): void => {
    const name = themeName.trim() || `Theme ${themes.length + 1}`
    const now = Date.now()
    const vars = buildThemeVarsFromHex(editorHexByKey, fallbackHexByKey)

    const existing = themes.find((item) => item.name.toLowerCase() === name.toLowerCase())
    let next: CustomTheme[]
    let activeId: string
    if (existing) {
      next = themes.map((item) => (item.id === existing.id ? { ...item, vars, updatedAt: now } : item))
      activeId = existing.id
      setStatus(`Updated theme "${name}".`)
    } else {
      const created: CustomTheme = {
        id: `theme_${now}_${Math.random().toString(16).slice(2, 8)}`,
        name,
        vars,
        createdAt: now,
        updatedAt: now
      }
      next = [created, ...themes]
      activeId = created.id
      setStatus(`Saved theme "${name}".`)
    }

    writeThemes(next)
    setThemes(next)
    setActiveThemeId(activeId)
  }

  const setActiveTheme = (id: string): void => {
    const theme = themes.find((item) => item.id === id)
    if (!theme) return
    applyThemeVars(theme.vars)
    const nextHex: Record<string, string> = {}
    for (const def of EDITABLE_THEME_VARS) {
      const raw = theme.vars[def.key] || ''
      const maybeHex = raw
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v))
      if (maybeHex.length >= 3) {
        const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
        nextHex[def.key] = `#${toHex(maybeHex[0])}${toHex(maybeHex[1])}${toHex(maybeHex[2])}`
      } else {
        nextHex[def.key] = fallbackHexByKey[def.key]
      }
    }
    setEditorHexByKey(nextHex)
    setThemeName(theme.name)
    setActiveThemeId(theme.id)
    setStatus(`Applied theme "${theme.name}".`)
  }

  const removeTheme = (id: string): void => {
    const next = themes.filter((item) => item.id !== id)
    writeThemes(next)
    setThemes(next)
    if (activeThemeId === id) {
      setActiveThemeId(null)
      clearThemeVars()
    }
    setStatus('Theme removed.')
  }

  const exportThemeJson = async (): Promise<void> => {
    const payload = {
      name: themeName.trim() || 'Shared Theme',
      vars: buildThemeVarsFromHex(editorHexByKey, fallbackHexByKey)
    }
    const text = JSON.stringify(payload, null, 2)
    await navigator.clipboard.writeText(text)
    setStatus('Theme JSON copied. You can publish/share it anywhere.')
  }

  const downloadThemeJson = (): void => {
    const payload = {
      name: themeName.trim() || 'Shared Theme',
      vars: buildThemeVarsFromHex(editorHexByKey, fallbackHexByKey)
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(payload.name || 'theme').replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Theme JSON exported.')
  }

  const importThemeFromJson = (): void => {
    try {
      const parsed = JSON.parse(importJson) as { name?: string; vars?: Record<string, string> }
      if (!parsed || typeof parsed !== 'object' || !parsed.vars) {
        setStatus('Invalid theme JSON.')
        return
      }
      const name = String(parsed.name || 'Imported Theme').trim()
      const vars: Record<string, string> = {}
      for (const def of EDITABLE_THEME_VARS) {
        vars[def.key] = String(parsed.vars[def.key] || buildThemeVarsFromHex(editorHexByKey, fallbackHexByKey)[def.key])
      }

      const now = Date.now()
      const created: CustomTheme = {
        id: `theme_${now}_${Math.random().toString(16).slice(2, 8)}`,
        name,
        vars,
        createdAt: now,
        updatedAt: now
      }
      const next = [created, ...themes]
      writeThemes(next)
      setThemes(next)
      setThemeName(name)
      setActiveTheme(created.id)
      setImportJson('')
      setStatus(`Imported and applied "${name}".`)
    } catch {
      setStatus('Failed to parse theme JSON.')
    }
  }

  const setActiveThemeId = (id: string | null): void => {
    setActiveThemeIdState(id)
    persistActiveThemeId(id)
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">Themes</h1>
          <p className="hero-subtitle">Theme manager, creator, and publish-ready sharing tools</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
        <section className="glass-panel rounded-2xl p-4 space-y-4 animate-rise">
          <div className="flex items-center gap-2">
            <Brush size={15} className="text-ctp-mauve" />
            <p className="panel-title">Theme Editor</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Theme name"
              className="input-base flex-1"
            />
            <button onClick={saveTheme} className="btn-primary">
              <Save size={13} />
              Save Theme
            </button>
            <button onClick={applyCurrentEditor} className="btn-secondary">
              <Palette size={13} />
              Preview
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EDITABLE_THEME_VARS.map((item) => (
              <label key={item.key} className="rounded-xl border border-ctp-surface1/70 bg-ctp-surface0/40 px-3 py-2">
                <p className="text-[11px] text-ctp-subtext1">{item.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={editorHexByKey[item.key] || item.fallbackHex}
                    onChange={(e) =>
                      setEditorHexByKey((current) => ({
                        ...current,
                        [item.key]: e.target.value
                      }))
                    }
                    className="h-7 w-9 rounded border border-ctp-surface1/80 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={editorHexByKey[item.key] || item.fallbackHex}
                    onChange={(e) =>
                      setEditorHexByKey((current) => ({
                        ...current,
                        [item.key]: e.target.value
                      }))
                    }
                    className="input-base h-8 py-1.5 text-xs"
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => void exportThemeJson()} className="btn-secondary">
              <Copy size={13} />
              Copy Publish JSON
            </button>
            <button onClick={downloadThemeJson} className="btn-secondary">
              <Download size={13} />
              Export JSON File
            </button>
          </div>

          <div className="rounded-xl border border-ctp-surface1/70 bg-ctp-surface0/40 p-3">
            <p className="text-xs font-semibold text-ctp-text">Import Theme JSON</p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={4}
              placeholder='Paste {"name":"...", "vars":{"ctp-base":"30, 20, 24"}}'
              className="input-base w-full mt-2 resize-none"
            />
            <button onClick={importThemeFromJson} className="btn-accent mt-2">
              <Upload size={13} />
              Import Theme
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-4 space-y-3 animate-rise-delayed">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-ctp-green" />
            <p className="panel-title">Saved Themes</p>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {themes.length === 0 && <p className="text-xs text-ctp-subtext1">No custom themes saved yet.</p>}
            {themes.map((item) => (
              <article
                key={item.id}
                className={[
                  'rounded-xl border px-3 py-2',
                  activeThemeId === item.id
                    ? 'border-ctp-green/40 bg-ctp-green/10'
                    : 'border-ctp-surface1/70 bg-ctp-surface0/40'
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ctp-text">{item.name}</p>
                    <p className="text-[11px] text-ctp-subtext1">
                      Updated {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setActiveTheme(item.id)} className="btn-secondary text-xs px-2 py-1.5">
                      Apply
                    </button>
                    <button onClick={() => removeTheme(item.id)} className="btn-secondary text-xs px-2 py-1.5">
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="text-xs text-ctp-subtext1">{status}</p>
        </section>
      </div>
    </div>
  )
}
