import { useEffect, useMemo, useState } from 'react'
import { Rss, ImageIcon, Send, Sparkles, Clock3, Trash2 } from 'lucide-react'
import { CHANNELS } from '../../shared/ipc-channels'
import type { FeedPost, Settings } from '../../shared/types'

function dedupePosts(posts: FeedPost[]): FeedPost[] {
  const seen = new Set<string>()
  return posts
    .filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export default function FeedPage(): JSX.Element {
  const [isOwner, setIsOwner] = useState(false)
  const [draft, setDraft] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [posts, setPosts] = useState<FeedPost[]>([])

  useEffect(() => {
    void loadAll()
  }, [])

  const totalReactions = useMemo(
    () => posts.reduce((acc, post) => acc + post.reactions.up + post.reactions.down, 0),
    [posts]
  )

  const loadAll = async (): Promise<void> => {
    const [settingsResult, feedResult] = await Promise.all([
      window.octopus.invoke<Settings>(CHANNELS.SETTINGS_GET),
      window.octopus.invoke<FeedPost[]>(CHANNELS.FEED_GET)
    ])

    if (settingsResult.success) {
      setIsOwner(settingsResult.data.isOwner)
    }

    if (feedResult.success) {
      setPosts(dedupePosts(feedResult.data))
    } else {
      setStatusMessage(feedResult.error)
    }
  }

  const post = async (): Promise<void> => {
    const result = await window.octopus.invoke<FeedPost>(CHANNELS.FEED_POST, { text: draft })
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setDraft('')
    setPosts((current) => dedupePosts([result.data, ...current]))
    setStatusMessage('Post created.')
  }

  const removePost = async (postId: string): Promise<void> => {
    const result = await window.octopus.invoke<FeedPost[]>(CHANNELS.FEED_DELETE, { postId })
    if (!result.success) {
      setStatusMessage(result.error)
      return
    }

    setPosts(dedupePosts(result.data))
    setStatusMessage('Post removed.')
  }

  return (
    <div className="flex flex-col h-full bg-ctp-base page-shell">
      <header className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface1/70 shrink-0 glass-panel">
        <div>
          <h1 className="hero-title">Group Feed</h1>
          <p className="hero-subtitle">Announcements and updates for your crew</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs">
          <StatPill label={`${posts.length} posts`} />
          <StatPill label={`${totalReactions} reactions`} />
        </div>
      </header>

      <div className="px-6 py-3 border-b border-ctp-surface1/50 shrink-0">
        <div className="glass-panel rounded-2xl p-4 animate-rise">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-ctp-mauve" />
            <p className="panel-title">Owner Composer</p>
          </div>
          <textarea
            disabled={!isOwner}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isOwner ? 'Write an announcement...' : 'Enable owner mode in Settings to post'}
            className={[
              'input-base w-full resize-none text-sm',
              isOwner ? '' : 'cursor-not-allowed'
            ].join(' ')}
            rows={3}
          />
          <div className="flex items-center justify-between mt-2">
            <button disabled className="btn-secondary opacity-70 cursor-not-allowed">
              <ImageIcon size={13} />
              Attach Image (soon)
            </button>
            <button
              disabled={!isOwner || !draft.trim()}
              onClick={() => void post()}
              className={[
                'btn-primary',
                !isOwner || !draft.trim() ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''
              ].join(' ')}
            >
              <Send size={12} />
              Post
            </button>
          </div>
          <p className="text-[11px] text-ctp-subtext1 mt-2">
            {statusMessage || (isOwner ? 'Owner mode enabled.' : 'Owner mode disabled.')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {posts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8 animate-rise">
            <div className="w-16 h-16 rounded-2xl bg-ctp-surface0 flex items-center justify-center">
              <Rss size={28} className="text-ctp-subtext0" />
            </div>
            <div>
              <p className="text-ctp-text font-semibold text-sm">No announcements yet</p>
              <p className="text-ctp-subtext1 text-xs mt-1 max-w-xs leading-relaxed">
                Your future post updates will appear here as a timeline.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((postItem) => (
              <article
                key={postItem.id}
                className="glass-panel rounded-2xl p-4 animate-rise"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-ctp-text">{postItem.authorId}</p>
                  <div className="inline-flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 text-[11px] text-ctp-subtext1">
                      <Clock3 size={12} />
                      {new Date(postItem.createdAt).toLocaleString()}
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => void removePost(postItem.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-ctp-red/40 text-ctp-red text-[11px] hover:bg-ctp-red/10 transition-colors"
                      >
                        <Trash2 size={11} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-ctp-subtext0 leading-relaxed whitespace-pre-wrap">{postItem.text}</p>
                <div className="flex items-center gap-2 mt-3">
                  <StatPill label={`Up ${postItem.reactions.up}`} />
                  <StatPill label={`Down ${postItem.reactions.down}`} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label }: { label: string }): JSX.Element {
  return (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium border bg-ctp-surface0/90 text-ctp-subtext0 border-ctp-surface1">
      {label}
    </span>
  )
}
