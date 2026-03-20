export interface CustomTheme {
  id: string
  name: string
  vars: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface ThemeVarDef {
  key: string
  label: string
  fallbackHex: string
}

const THEMES_KEY = 'octopus:themes'
const ACTIVE_THEME_KEY = 'octopus:activeThemeId'

export const EDITABLE_THEME_VARS: ThemeVarDef[] = [
  { key: 'ctp-text', label: 'Text', fallbackHex: '#f5eaf0' },
  { key: 'ctp-subtext1', label: 'Subtext 1', fallbackHex: '#c9acb4' },
  { key: 'ctp-subtext0', label: 'Subtext 0', fallbackHex: '#ae9098' },
  { key: 'ctp-base', label: 'Base', fallbackHex: '#1e1418' },
  { key: 'ctp-mantle', label: 'Mantle', fallbackHex: '#170f12' },
  { key: 'ctp-crust', label: 'Crust', fallbackHex: '#100a0d' },
  { key: 'ctp-surface0', label: 'Surface 0', fallbackHex: '#322327' },
  { key: 'ctp-surface1', label: 'Surface 1', fallbackHex: '#412f34' },
  { key: 'ctp-surface2', label: 'Surface 2', fallbackHex: '#4f3a40' },
  { key: 'ctp-mauve', label: 'Mauve', fallbackHex: '#ff6c6c' },
  { key: 'ctp-blue', label: 'Blue', fallbackHex: '#6793ff' },
  { key: 'ctp-green', label: 'Green', fallbackHex: '#8fdc99' },
  { key: 'ctp-yellow', label: 'Yellow', fallbackHex: '#ffd578' },
  { key: 'ctp-red', label: 'Red', fallbackHex: '#ff5c5c' },
  { key: 'ctp-pink', label: 'Pink', fallbackHex: '#ff85a8' },
  { key: 'ctp-teal', label: 'Teal', fallbackHex: '#7cdbd3' },
  { key: 'ctp-lavender', label: 'Lavender', fallbackHex: '#b3a8ff' },
  { key: 'ctp-peach', label: 'Peach', fallbackHex: '#ff9066' }
]

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function hexToTriplet(hex: string): string {
  const normalized = hex.replace('#', '').trim()
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return '255, 255, 255'
  }

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `${clampColor(r)}, ${clampColor(g)}, ${clampColor(b)}`
}

export function tripletToHex(triplet: string): string {
  const numbers = triplet
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v))

  if (numbers.length < 3) {
    return '#ffffff'
  }

  const toHex = (value: number): string => clampColor(value).toString(16).padStart(2, '0')
  return `#${toHex(numbers[0])}${toHex(numbers[1])}${toHex(numbers[2])}`
}

export function applyThemeVars(vars: Record<string, string>): void {
  const html = document.documentElement
  const body = document.body
  for (const [key, value] of Object.entries(vars)) {
    html.style.setProperty(`--${key}`, value)
    body.style.setProperty(`--${key}`, value)
  }
}

export function clearThemeVars(): void {
  const html = document.documentElement
  const body = document.body
  for (const { key } of EDITABLE_THEME_VARS) {
    html.style.removeProperty(`--${key}`)
    body.style.removeProperty(`--${key}`)
  }
}

export function readThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(THEMES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CustomTheme => Boolean(item && typeof item === 'object' && (item as any).id))
  } catch {
    return []
  }
}

export function writeThemes(themes: CustomTheme[]): void {
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes))
}

export function getActiveThemeId(): string | null {
  return localStorage.getItem(ACTIVE_THEME_KEY)
}

export function setActiveThemeId(id: string | null): void {
  if (!id) {
    localStorage.removeItem(ACTIVE_THEME_KEY)
    return
  }
  localStorage.setItem(ACTIVE_THEME_KEY, id)
}

export function buildThemeVarsFromHex(
  hexByKey: Record<string, string>,
  fallbackHexByKey: Record<string, string>
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const def of EDITABLE_THEME_VARS) {
    const hex = hexByKey[def.key] || fallbackHexByKey[def.key] || def.fallbackHex
    vars[def.key] = hexToTriplet(hex)
  }
  return vars
}

export function buildHexFromComputedStyle(): Record<string, string> {
  const style = getComputedStyle(document.documentElement)
  const next: Record<string, string> = {}
  for (const def of EDITABLE_THEME_VARS) {
    const triplet = style.getPropertyValue(`--${def.key}`).trim()
    next[def.key] = triplet ? tripletToHex(triplet) : def.fallbackHex
  }
  return next
}
