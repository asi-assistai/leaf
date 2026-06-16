# LEAF — Technical Specification v0.1.0

> The Detachable Widget Browser: one website, many leaves.

## Quick Context for Claude Code

This spec defines **Leaf**, a browser that lets users detach widgets from websites and place them anywhere on their desktop as independent, live-connected windows ("leaves"). Built on **Tauri v2 + Servo/system webview**, it introduces a **Widget Manifest** that websites use to declare decomposable regions, a **DetachChannel** for state sync, and a **window manager** for desktop-native UX.

**Start with task B1** in the task breakdown (Section 14). Each task is scoped for a single session and produces a testable artifact.

---

## 1. Vision

Leaf reimagines the browser as a windowing system. Instead of confining a website to a single tab, users can detach any compatible widget from a page and place it anywhere on their desktop — across monitors, above other windows, in persistent positions that survive navigation and restarts.

**Core principles:**
- **Decomposition over tabs** — websites are collections of widgets, not monolithic pages
- **Live connection** — detached leaves share auth, state, and data channels with the source
- **Progressive adoption** — sites gain value at every tier, from zero-config heuristics to full API integration
- **Desktop-native feel** — leaves are real OS windows with minimize, resize, snap-to-edge, z-ordering
- **Open protocol** — the manifest and APIs are open standards, not vendor lock-in

---

## 2. Architecture

### 2.1 Layer Stack

| Layer | Name | Responsibility |
|-------|------|----------------|
| L1 | Native Shell (Tauri) | OS windows, tray icon, taskbar, multi-monitor layout, IPC bus |
| L2 | Engine (Servo/WebView) | Web rendering, JS execution, DOM, networking per webview |
| L3 | Widget Protocol | Manifest discovery, detach/dock lifecycle, state channels |
| L4 | Window Manager | Desktop metaphor: snap, z-order, minimize, persist positions |

### 2.2 Data Flow (Detach Sequence)

1. Browser reads the widget manifest (or scans for `[detachable]` attributes)
2. New native OS window spawned via Tauri's multi-window API
3. Widget's DOM subtree cloned or moved into a new webview in that window
4. DetachChannel established between source tab's webview and leaf's webview
5. Auth context (cookies, tokens) shared via same-origin enforcement
6. Window manager registers the leaf for position persistence and z-order tracking

### 2.3 Process Model

Each leaf runs in its own webview process, isolated from the source tab. If a leaf crashes, the source page is unaffected. If the source tab navigates away, leaves enter orphan mode and can reconnect when the user returns.

---

## 3. Widget Manifest Specification

Extends the W3C Web App Manifest with a `detachable_widgets` array.

### 3.1 Full Schema

```json
{
  "name": "TradingApp",
  "short_name": "Trade",
  "start_url": "/",
  "display": "standalone",
  "detachable_widgets": [
    {
      "id": "stock-ticker",
      "selector": "#widget-ticker",
      "title": "Live Ticker",
      "icon": "/icons/ticker.svg",
      "min_size": { "width": 280, "height": 120 },
      "preferred_size": { "width": 400, "height": 200 },
      "max_size": { "width": 800, "height": 600 },
      "resizable": true,
      "always_on_top": false,
      "state_channel": "ticker-sync",
      "detach_behavior": "clone",
      "requires": ["auth", "websocket"],
      "orphan_policy": "persist",
      "snap_zones": ["right", "bottom"]
    }
  ]
}
```

### 3.2 Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this widget |
| `selector` | string | Yes | CSS selector to locate the widget in the DOM |
| `title` | string | Yes | Name shown in the leaf window title bar |
| `icon` | string | No | Path to icon for title bar and taskbar |
| `min_size` | `{width, height}` | No | Minimum dimensions in CSS pixels |
| `preferred_size` | `{width, height}` | No | Default size when first detached |
| `max_size` | `{width, height}` | No | Maximum allowed size |
| `resizable` | boolean | No | Whether the leaf can be resized (default: true) |
| `always_on_top` | boolean | No | Float above other windows (default: false) |
| `state_channel` | string | No | Named channel for bidirectional state sync |
| `detach_behavior` | enum | No | `clone` \| `move` \| `pip` (default: clone) |
| `requires` | string[] | No | Capabilities: auth, websocket, camera, etc. |
| `orphan_policy` | enum | No | `persist` \| `snapshot` \| `close` (default: persist) |
| `snap_zones` | string[] | No | Preferred snap positions: top, right, bottom, left |

### 3.3 detach_behavior

- **clone** — Widget stays in-page AND in the leaf. Both synced via channel.
- **move** — Widget removed from page, transferred to leaf. Returns on dock.
- **pip** — Compact always-on-top overlay (Document PiP style).

### 3.4 orphan_policy

- **persist** — Leaf stays alive when source tab navigates away. Reconnects on return.
- **snapshot** — Leaf freezes to static snapshot. No updates.
- **close** — Leaf closes when source tab navigates away.

---

## 4. HTML Attribute API

For simple adoption without a manifest.

```html
<section
  detachable
  detach-title="Stock Ticker"
  detach-icon="/icons/ticker.svg"
  detach-behavior="clone"
  detach-channel="ticker-sync"
  detach-min-width="280"
  detach-min-height="120"
  detach-preferred-width="400"
  detach-preferred-height="200"
  detach-orphan="persist"
>
  <!-- widget content -->
</section>
```

**Browser affordances on `[detachable]` elements:**
- Grip handle icon (top-right corner, visible on hover)
- Right-click → "Detach to desktop"
- Keyboard: Ctrl/Cmd + Shift + D
- Drag grip handle outside browser to spawn leaf

---

## 5. Web Component API

```html
<detachable-widget
  title="Chat"
  channel="chat-sync"
  behavior="move"
  icon="/icons/chat.svg"
>
  <my-chat-component slot="content" />
</detachable-widget>
```

### 5.1 Events

| Event | Fires When | event.detail |
|-------|------------|--------------|
| `ondetach` | Widget detached from page | `{ leafId, windowBounds }` |
| `onreattach` | Widget docked back | `{ leafId, finalState }` |
| `onstatechange` | State from other side | `{ channelName, data }` |
| `onorphan` | Source tab navigated away | `{ policy, lastState }` |
| `onreconnect` | Source tab returned | `{ leafId, timeSinceOrphan }` |

### 5.2 Programmatic API

```typescript
const widget = document.querySelector("detachable-widget");

// Detach
const leaf = await widget.detach({
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  screen: screenDetails.screens[1]  // W3C Window Management
});

// Dock
await widget.dock();

// State
widget.isDetached;   // boolean
widget.leafWindow;   // Window | null
```

---

## 6. DetachChannel — State Synchronization

### 6.1 Source Page

```typescript
const channel = new DetachChannel("ticker-sync");

channel.ondetach = (leaf) => {
  leaf.postState({
    symbols: ["AAPL", "GOOG", "MSFT"],
    interval: 5000,
    theme: "dark"
  });
};

channel.onstatechange = (event) => {
  updatePortfolio(event.data.selectedSymbol);
};

// Broadcast to all leaves
channel.broadcastState({ marketStatus: "open" });

// Send to specific leaf
channel.postStateTo(leafId, { alert: "AAPL > 200" });
```

### 6.2 Leaf Page

```typescript
const channel = DetachChannel.fromLeaf();

channel.onstate = (state) => {
  renderTicker(state.symbols, state.interval);
};

channel.postState({ selectedSymbol: "AAPL" });

channel.onorphan = () => showReconnectingBanner();
channel.onreconnect = () => hideReconnectingBanner();
```

### 6.3 Transport

- **Primary:** Tauri IPC (Rust event bus between webview processes)
- **Fallback:** SharedWorker (web-standard, for running in a normal browser)
- **Simple cases:** BroadcastChannel (fire-and-forget one-way pushes)

### 6.4 Auth & Session Sharing

Leaves inherit from the source tab:
- Same-origin cookies (including HttpOnly)
- Service Worker registrations
- IndexedDB and localStorage access
- WebSocket connections (proxied or independent, per manifest `requires`)

---

## 7. Widget Lifecycle

### 7.1 State Machine

```
embedded → detaching → detached → docking → embedded
                         ↓
                      orphaned → reconnected → detached
                         ↓
                       closed
```

| State | Description |
|-------|-------------|
| `embedded` | Widget is inside the source page (default) |
| `detaching` | Browser is spawning the leaf window |
| `detached` | Widget in its own window, channel active |
| `orphaned` | Source tab navigated away, leaf persists |
| `reconnected` | Source tab returned, channel re-established |
| `docking` | User closed leaf or triggered dock |
| `closed` | Leaf window destroyed |

### 7.2 Session Persistence

```json
{
  "source_url": "https://app.example.com/dashboard",
  "leaves": [
    {
      "widget_id": "stock-ticker",
      "window_bounds": { "x": 1920, "y": 0, "w": 400, "h": 200 },
      "screen_id": "external-1",
      "z_index": 2,
      "last_state": { "symbols": ["AAPL"], "interval": 5000 }
    }
  ],
  "saved_at": "2026-04-04T10:30:00Z"
}
```

---

## 8. Security Model

- **Same-origin enforcement:** Leaves only from same-origin content
- **Permission inheritance:** Leaves inherit but cannot escalate permissions
- **Process isolation:** Each leaf in its own webview process
- **Channel isolation:** DetachChannels scoped to origin
- **CSP compliance:** Detached widgets honor source page's CSP
- **No prompt injection surface:** Manifests are static declarations

---

## 9. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Native Shell | Tauri v2 | Multi-window, Rust IPC, ~3MB binaries |
| Engine | Servo (via Verso) | Rust, embeddable, multi-webview support |
| Fallback Engine | System WebView | Production fallback while Servo matures |
| Window Manager | Custom Rust + WinBox.js concepts | OS-level + in-page windowing |
| State Sync | Tauri IPC + SharedWorker polyfill | Reliable IPC with web fallback |
| Build | Cargo + pnpm + Vite | Rust core, TS/JS web UI, fast HMR |
| Testing | WebDriver + Playwright | E2E + visual regression |

---

## 10. Website Compatibility Tiers

| Tier | Effort | What the site does |
|------|--------|-------------------|
| 0 | Zero | Browser auto-detects via heuristics + ARIA roles |
| 1 | 5 min | Add `detachable` attribute to elements |
| 2 | 30 min | Add `detachable_widgets` to manifest.json |
| 3 | Hours+ | Use DetachChannel API + custom element for full sync |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Weeks 1–4)
**Goal:** Working Tauri shell that detaches DOM elements into separate windows.

- [ ] Tauri v2 + Vite + TypeScript project scaffold
- [ ] Multi-window webview management (create, destroy, resize, move)
- [ ] Manifest parser (Rust)
- [ ] DOM extraction (clone/move subtree to new webview)
- [ ] GripHandle component (hover affordance)
- [ ] Drag-to-detach (grip handle → spawn leaf)
- [ ] Session persistence (save/restore leaf positions)
- **Deliverable:** Demo app with 3 detachable widgets

### Phase 2: State Sync (Weeks 5–8)
**Goal:** Bidirectional state synchronization.

- [ ] DetachChannel over Tauri IPC (Rust event bus)
- [ ] SharedWorker polyfill
- [ ] Structured clone serialization
- [ ] Auth context sharing (cookies, service workers)
- [ ] WebSocket multiplexing
- [ ] Orphan mode + reconnection
- **Deliverable:** Live stock ticker with real-time updates to detached leaves

### Phase 3: Window Manager (Weeks 9–12)
**Goal:** Desktop-native window management.

- [ ] Edge snapping
- [ ] Z-order management
- [ ] Minimize-to-tray
- [ ] Multi-monitor awareness (W3C Window Management API)
- [ ] Layout presets
- [ ] Leaf taskbar with thumbnails
- [ ] Keyboard navigation (Cmd+Tab, Cmd+Shift+D)
- **Deliverable:** Full WM with snapping, tray, taskbar, presets

### Phase 4: Heuristic Engine (Weeks 13–16)
**Goal:** Zero-config detection for existing websites.

- [ ] DOM classifier (size, position, ARIA, mutation rate)
- [ ] Common pattern matching (video, chat, notifications)
- [ ] Detach suggestion UI
- [ ] User override system (manual mark-as-detachable)
- [ ] Per-site memory
- **Deliverable:** Detach widgets from YouTube/Gmail/Slack with zero changes

### Phase 5: Ecosystem (Weeks 17–24)
**Goal:** Developer tools, docs, community.

- [ ] DevTools panel (channels, states, lifecycle)
- [ ] Manifest Validator (CLI + VS Code extension)
- [ ] Developer Guide (all tiers)
- [ ] Framework wrappers (React, Vue, Svelte)
- [ ] Open RFC publication
- [ ] Servo engine swap
- [ ] Performance benchmarks
- **Deliverable:** Open-source release with docs + examples

---

## 12. File Structure

```
leaf/
├── src-tauri/                    # Rust native shell
│   ├── src/
│   │   ├── main.rs               # App entry, window creation
│   │   ├── ipc.rs                # DetachChannel Rust-side bus
│   │   ├── manifest.rs           # Widget manifest parser
│   │   ├── window_manager.rs     # Multi-window + snap + z-order
│   │   ├── session.rs            # Session persistence
│   │   ├── heuristics.rs         # Tier 0 auto-detection
│   │   └── security.rs           # Origin enforcement, sandbox
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # Web frontend (browser UI)
│   ├── shell/
│   │   ├── App.tsx
│   │   ├── AddressBar.tsx
│   │   ├── TabBar.tsx
│   │   ├── LeafTaskbar.tsx
│   │   └── GripHandle.tsx
│   ├── protocol/
│   │   ├── DetachChannel.ts
│   │   ├── SharedWorkerFallback.ts
│   │   └── types.ts
│   ├── components/
│   │   └── DetachableWidget.ts
│   └── wm/
│       ├── SnapEngine.ts
│       ├── ZOrderManager.ts
│       └── LayoutPresets.ts
├── examples/
│   ├── trading-dashboard/        # Tier 3 demo
│   ├── simple-detach/            # Tier 1 demo
│   └── manifest-only/            # Tier 2 demo
├── packages/
│   ├── react-leaf/
│   ├── vue-leaf/
│   └── manifest-validator/
├── docs/
│   ├── spec.md
│   ├── getting-started.md
│   └── api-reference.md
├── tests/
│   ├── e2e/
│   ├── unit/
│   └── fixtures/
├── package.json
├── vite.config.ts
└── README.md
```

---

## 13. Claude Code Task Breakdown

### Bootstrap

| # | Task | Output | Est. |
|---|------|--------|------|
| B1 | Initialize Tauri v2 + Vite + TS project | Scaffolded project, builds and runs | 15m |
| B2 | Create TypeScript types for manifest schema | `src/protocol/types.ts` | 10m |
| B3 | Build manifest parser (Rust) | `src-tauri/src/manifest.rs` | 20m |
| B4 | Implement multi-window Tauri commands | `create_leaf_window`, `close_leaf`, `list_leaves` | 25m |

### Core Protocol

| # | Task | Output | Est. |
|---|------|--------|------|
| C1 | DetachChannel (Rust IPC side) | `src-tauri/src/ipc.rs` | 30m |
| C2 | DetachChannel (TypeScript client) | `src/protocol/DetachChannel.ts` | 25m |
| C3 | DOM extraction engine | JS clone/move subtree to new webview | 30m |
| C4 | GripHandle component | `src/shell/GripHandle.tsx` | 20m |
| C5 | `<detachable-widget>` custom element | `src/components/DetachableWidget.ts` | 30m |
| C6 | Lifecycle state machine | State transitions, orphan/reconnect | 25m |

### Window Management

| # | Task | Output | Est. |
|---|------|--------|------|
| W1 | Edge snapping | `src/wm/SnapEngine.ts` | 25m |
| W2 | Z-order manager | `src/wm/ZOrderManager.ts` | 20m |
| W3 | Session persistence | `src-tauri/src/session.rs` | 20m |
| W4 | Leaf taskbar | `src/shell/LeafTaskbar.tsx` | 25m |
| W5 | Layout presets | Save/name/recall arrangements | 20m |
| W6 | Keyboard shortcuts | Cmd+Shift+D, Cmd+Tab via Tauri | 15m |

### Heuristics & Polish

| # | Task | Output | Est. |
|---|------|--------|------|
| H1 | DOM classifier (Tier 0) | `src-tauri/src/heuristics.rs` | 30m |
| H2 | User override system | Manual mark-as-detachable | 20m |
| H3 | Manifest Validator CLI | `packages/manifest-validator/` | 20m |
| H4 | Trading dashboard example | `examples/trading-dashboard/` | 45m |
| H5 | Simple-detach example | `examples/simple-detach/` | 15m |
| H6 | E2E test suite | `tests/e2e/` with Playwright | 30m |

### Documentation

| # | Task | Output | Est. |
|---|------|--------|------|
| D1 | Formal spec.md | `docs/spec.md` | 30m |
| D2 | Getting started guide | `docs/getting-started.md` | 20m |
| D3 | API reference | `docs/api-reference.md` | 25m |
| D4 | README.md | Root README with install + usage | 15m |

---

*Leaf v0.1.0 — Draft — April 2026*
*Ready for Claude Code implementation.*
