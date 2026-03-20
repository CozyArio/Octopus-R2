# Octopus-R2

> Private game tools suite for a friend group.

![Electron](https://img.shields.io/badge/Electron-30+-47848F?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Catppuccin](https://img.shields.io/badge/Theme-Catppuccin-CBA6F7)

Octopus-R2 is an Electron desktop application for Windows that gives a private friend group a unified dashboard to manage their Steam game libraries, DLC configurations, and stay connected over ZeroTier — no port forwarding required.

---

## Features

| Module | Description |
|---|---|
| **Game Library** | View all games added via SteamTools `.lua` plugins, with cover art and install status |
| **DLC Manager** | Browse, toggle, and generate GreenLuma / CreamAPI configs for each game's DLCs |
| **Broadcast Feed** | Discord-like announcement feed — group owner posts text and image updates |
| **Social / Group** | See who's online over ZeroTier, share game lists, find games for LAN co-op |
| **Settings** | Configure Steam path, ZeroTier network, DLC tool preference, and Catppuccin flavour |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [ZeroTier One](https://www.zerotier.com/download/) installed and running on every group member's machine
- All group members joined to the same ZeroTier network ID

---

## Quick Start

```bash
npm install
npm run dev
```

```bash
npm run build
```

---

## ZeroTier Setup

1. Install ZeroTier One on every machine in the group.
2. Each member runs `zerotier-cli join <NETWORK_ID>` or joins via the ZeroTier tray app.
3. The network admin approves each member in the [ZeroTier Central](https://my.zerotier.com) dashboard.
4. Enter the Network ID once in Octopus-R2 Settings — the app discovers peers automatically.
5. No port forwarding, no static IPs required.

---

## Folder Structure

```
Octopus-R2/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Entry point
│   │   ├── ipc/               # IPC handlers (one file per domain)
│   │   ├── steam/             # Steam integration modules
│   │   │   ├── scanner.ts     # Detect Steam path, scan installs
│   │   │   ├── vdf.ts         # VDF parser/writer
│   │   │   ├── steamtools.ts  # .lua manifest reader
│   │   │   ├── dlc.ts         # DLC list + toggle logic
│   │   │   └── generators.ts  # GreenLuma / CreamAPI config writer
│   │   ├── zerotier/          # ZeroTier API + peer sync
│   │   │   ├── peer.ts        # Local ZeroTier API client
│   │   │   └── sync.ts        # TCP socket sync with peers
│   │   └── store/
│   │       └── index.ts       # electron-store wrapper
│   ├── renderer/              # React + Vite UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── pages/             # Page components
│   │   ├── components/        # Shared UI components
│   │   └── styles/            # Global CSS + Catppuccin tokens
│   └── shared/
│       ├── types.ts           # Shared TypeScript interfaces
│       └── ipc-channels.ts    # IPC channel name constants
├── ARCHITECTURE.md
├── FEATURES.md
├── package.json
└── tsconfig.json
```
