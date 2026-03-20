# Features — Octopus-R2

## Module 1 — Game Library

**Purpose:** Give the user a visual overview of every game they have unlocked via SteamTools.

### How it works

- On scan, the app reads all `.lua` files from the SteamTools plugin directory (`<steam>/config/stplug-in/`).
- Each `.lua` file is parsed to extract the game's `AppID` and display name.
- The app cross-references each AppID against `appmanifest_<APPID>.acf` in `<steam>/steamapps/` to determine install status.
- Cover art is fetched from the Steam CDN: `https://cdn.cloudflare.steamstatic.com/steam/apps/<APPID>/library_600x900.jpg`

### UI

- Card grid layout, each card shows: cover art, game name, AppID, install status badge (Installed / Not Installed), date the `.lua` was added.
- Search and filter bar (by name, install status).
- Click a card to open the DLC Manager for that game.
- Remove button on each card: deletes the `.lua` file and removes the corresponding entry from `config.vdf`.

### IPC Channels Used

| Channel | Direction | Payload |
|---|---|---|
| `steam:scan` | invoke | — |
| `steam:games` | invoke | — |
| `steam:remove` | invoke | `{ appId: string }` |

---

## Module 2 — DLC Manager

**Purpose:** Browse, toggle, and generate tool configs for a game's DLCs.

### How it works

- User selects a game from the library to open its DLC view.
- The app resolves the full DLC list for that AppID from a local JSON cache (bundled or downloaded from SteamDB-compatible sources). An optional refresh button fetches the latest list.
- Current enabled/disabled state for each DLC is read from `electron-store`.
- Toggle switches update the store immediately.
- "Apply" button writes the config file:
  - **GreenLuma**: writes `DLCList.txt` in the format GreenLuma expects.
  - **CreamAPI**: writes `cream_api.ini` into the game's install directory.
- The app warns the user if Steam is currently running before writing any config.

### Config File Formats

**GreenLuma `DLCList.txt`** (one AppID per line, prepended with index):
```
1=DLCAPPID1
2=DLCAPPID2
```

**CreamAPI `cream_api.ini`**:
```ini
[steam]
appid=GAMEAPPID

[dlc]
DLCAPPID1=DLC Name 1
DLCAPPID2=DLC Name 2
```

### IPC Channels Used

| Channel | Direction | Payload |
|---|---|---|
| `dlc:list` | invoke | `{ appId: string }` |
| `dlc:toggle` | invoke | `{ appId: string, dlcId: string, enabled: boolean }` |
| `dlc:generate` | invoke | `{ appId: string, tool: 'greenluma' \| 'creamapi' }` |
| `steam:isRunning` | invoke | — |

---

## Module 3 — Broadcast Feed

**Purpose:** Let the group owner post announcements, updates, or links that all group members see inside the app.

### How it works

- Feed is a vertical scroll of posts, newest at top — similar to a Discord announcements channel.
- **Owner** (identified by a flag in `electron-store` settings, set once via owner key or password) can:
  - Compose and submit a post (text + optional image attachment from local disk).
  - Delete their own posts.
- **Non-owners** see the feed as read-only.
- Posts are persisted locally in `electron-store`.
- When a peer connects over ZeroTier, the app pushes any posts the peer doesn't have yet (last-seen timestamp comparison).
- Reactions: any user can thumbs-up or thumbs-down a post. Reaction counts are stored locally and synced to the poster's machine on next connection.

### Post Structure

```typescript
interface FeedPost {
  id: string
  authorId: string
  text: string
  imageBase64?: string
  createdAt: number
  reactions: { up: number; down: number }
}
```

### IPC Channels Used

| Channel | Direction | Payload |
|---|---|---|
| `feed:get` | invoke | — |
| `feed:post` | invoke | `{ text: string, imageBase64?: string }` |
| `feed:delete` | invoke | `{ postId: string }` |
| `feed:react` | invoke | `{ postId: string, reaction: 'up' \| 'down' }` |
| `feed:push` | on (event) | `FeedPost[]` — pushed by ZeroTier sync |

---

## Module 4 — Social / Group View

**Purpose:** See who in the friend group is online via ZeroTier, browse their game libraries, and find games for co-op sessions.

### How it works

- The app queries the ZeroTier local API for all members of the configured network.
- For each member: performs a TCP ping to their Octopus-R2 socket port to determine online status and latency.
- If a peer has enabled "Share my library", their game list is fetched over the ZeroTier TCP connection.
- **LAN Party Helper**: compares game libraries across all online peers and surfaces games owned by 2+ members simultaneously — useful for choosing a co-op game everyone can play.

### Peer Card

Each online peer shows:
- Nickname (set in their own Settings)
- Online / Offline status + ping (ms)
- Shared game count (if sharing enabled)
- Shared DLC count (if sharing enabled)
- "View Library" button — opens a read-only library view for that peer

### IPC Channels Used

| Channel | Direction | Payload |
|---|---|---|
| `zt:status` | invoke | — |
| `zt:peers` | invoke | — |
| `zt:share` | invoke | `{ enabled: boolean }` |
| `zt:peerLibrary` | invoke | `{ peerId: string }` |
| `zt:peerUpdate` | on (event) | `PeerInfo` — pushed when a peer connects |

---

## Module 5 — Settings

**Purpose:** Configure all user-specific options in one place.

### Settings Fields

| Setting | Type | Default | Description |
|---|---|---|---|
| `steamPath` | string | Auto-detected from registry | Override Steam install directory |
| `ztNetworkId` | string | — | ZeroTier Network ID to join |
| `ztAuthTokenPath` | string | `%APPDATA%\ZeroTier\One\authtoken.secret` | Path to ZeroTier auth token |
| `ztSyncPort` | number | `49152` | TCP port for peer sync server |
| `dlcTool` | `'greenluma' \| 'creamapi'` | `'greenluma'` | Global default DLC config tool |
| `nickname` | string | machine hostname | Display name shown to peers |
| `shareLibrary` | boolean | `false` | Broadcast game list to ZeroTier peers |
| `catppuccinFlavour` | `'mocha' \| 'macchiato' \| 'frappe' \| 'latte'` | `'mocha'` | UI colour theme flavour |
| `isOwner` | boolean | `false` | Enables Broadcast Feed post creation |
| `ownerKey` | string (hashed) | — | Key used to verify owner mode |

### Owner Mode Activation

- User enters an owner key in Settings.
- App hashes the key with SHA-256 and compares to the stored hash.
- If correct, `isOwner` is set to `true` in the local store.
- Owner key is never stored in plaintext.

### IPC Channels Used

| Channel | Direction | Payload |
|---|---|---|
| `settings:get` | invoke | — |
| `settings:set` | invoke | `Partial<Settings>` |
| `settings:verifyOwnerKey` | invoke | `{ key: string }` |
| `steam:detectPath` | invoke | — |
