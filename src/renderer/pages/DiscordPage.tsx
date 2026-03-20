import { useState } from 'react'
import { MessageCircleHeart, ExternalLink } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'

const DISCORD_INVITE = 'https://discord.gg/35C6kxCfVA'

export default function DiscordPage(): JSX.Element {
  const [status, setStatus] = useState('Want to join the Discord and test updates together?')

  const joinDiscord = async (): Promise<void> => {
    const result = await window.octopus.invoke<boolean>(CHANNELS.APP_OPEN_EXTERNAL, { url: DISCORD_INVITE })
    if (!result.success) {
      setStatus(result.error)
      return
    }

    setStatus('Discord invite opened. See you there.')
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">Discord</h1>
          <p className="hero-subtitle">Join the server to coordinate testing and updates</p>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <section className="glass-panel rounded-3xl p-6 max-w-2xl animate-rise">
          <div className="w-14 h-14 rounded-2xl bg-ctp-blue/15 border border-ctp-blue/30 flex items-center justify-center">
            <MessageCircleHeart size={26} className="text-ctp-blue" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ctp-text">Join CozyArio Discord?</h2>
          <p className="mt-2 text-sm text-ctp-subtext0 leading-relaxed">
            Click update when you are ready and I will open your invite instantly.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button onClick={() => void joinDiscord()} className="btn-primary">
              <ExternalLink size={14} />
              Join Discord
            </button>
            <span className="text-xs text-ctp-subtext1 truncate">{DISCORD_INVITE}</span>
          </div>
          <p className="mt-4 text-xs text-ctp-subtext1">{status}</p>
        </section>
      </div>
    </div>
  )
}
