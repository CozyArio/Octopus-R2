import { Construction, Hourglass } from 'lucide-react'

export default function DLCPage(): JSX.Element {
  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">DLC Manager</h1>
          <p className="hero-subtitle">Sorry, this section is currently work in progress.</p>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <section className="glass-panel rounded-3xl p-8 max-w-2xl animate-rise">
          <div className="w-14 h-14 rounded-2xl bg-ctp-yellow/15 border border-ctp-yellow/35 flex items-center justify-center">
            <Construction size={26} className="text-ctp-yellow" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ctp-text">Work in progress</h2>
          <p className="mt-2 text-sm text-ctp-subtext0 leading-relaxed">
            DLC Manager is being rebuilt for stability and better controls. Please use Library features for now.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-ctp-surface1/70 bg-ctp-surface0/45 px-3 py-2 text-xs text-ctp-subtext1">
            <Hourglass size={13} />
            Thanks for testing while we finish this module.
          </div>
        </section>
      </div>
    </div>
  )
}
