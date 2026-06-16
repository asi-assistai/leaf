# LEAF — Technical Specification v0.2.0 (Realistic Revision)

> The Detachable Widget Browser: one website, many leaves.

## 0. What changed from v0.1 — and why

v0.1 rested on one primitive: *"clone or move a widget's DOM subtree into a new, process-isolated webview, and it stays live."* **That primitive is physically impossible.** A widget is not a portable object — its behavior lives in event listeners (not copied by `cloneNode`), a JS realm (React/Vue/Svelte hold live references to the nodes), the CSS cascade (global stylesheets, `:root` vars, ancestor/container queries), and runtime state (sockets, timers, closures). You cannot serialize a closure or a socket, and you cannot move a live, framework-owned node across a process boundary. The shipping precedent — **Document Picture-in-Picture** — only stays live because it *moves* nodes within the **same JS realm and process**; Tauri's multi-window model gives each leaf its own process by design, which is exactly the boundary that kills the trick.

v0.2 keeps the full ambition — including **zero-config detach of arbitrary sites (Tier 0)** as a headline goal — but replaces the impossible primitive with three honest mechanisms and labels each by its real maturity and risk:

| Mechanism | What it is | Liveness | Maturity |
|---|---|---|---|
| **M1 — Cooperative re-mount** | Leaf loads a same-origin **widget entry point**; the site re-hydrates the widget; state syncs over DetachChannel | Truly live, bidirectional | **Ship-now (core)** |
| **M2 — Same-realm float (Document PiP)** | Leaf is a real PiP window in the *same* realm; nodes moved, not copied | Truly live | **Ship-now (in-browser fallback)** |
| **M3 — Remote view / live mirror** | Widget keeps running in the source page; leaf is a synchronized **projection** (full-page-load-and-crop, or DOM-mirror + event forwarding) | Live but a *projection*, not the original | **Experimental / high-risk R&D** |

**Tier 0 is delivered by M3.** It is real, it is buildable, and it is honestly hard. This spec documents the techniques, the cost, and the failure modes rather than pretending it's free.

---

## 1. Vision

Leaf reimagines the browser as a windowing system: detach a widget from a page and place it anywhere on the desktop as an independent OS window ("leaf"), live-connected to its source.

**Core principles:**
- **Decomposition over tabs** — websites are collections of widgets, not monolithic pages.
- **Live connection** — leaves share auth, state, and data with the source. *How* live depends on the mechanism (M1/M2 = true; M3 = projection).
- **Progressive adoption** — value at every tier, from best-effort heuristics to full API integration.
- **Honest about limits** — the protocol's credibility with site authors depends on it. See §13.
- **Open protocol** — manifest and APIs are open standards.

---

## 2. Architecture

### 2.1 Layer Stack

| Layer | Name | Responsibility |
|-------|------|----------------|
| L1 | Native Shell (Tauri v2) | OS windows, tray, taskbar, multi-monitor, IPC bus |
| L2 | Engine (system WebView; Servo later) | Web rendering per webview |
| L3 | Widget Protocol | Manifest discovery, entry-point resolution, detach/dock lifecycle, state channels |
| L4 | Window Manager | Snap, z-order, minimize, persist positions |
| L5 | **Projection Engine (new)** | M3 mirror: full-page isolation, or DOM-mirror + event forwarding |

### 2.2 Detach sequence — by mechanism

**M1 (cooperative, the default for adopting sites):**
1. Browser reads the manifest, resolves the widget's **`entry`** (a URL or a registered `mount(widgetId, root)` hook).
2. Tauri spawns a new OS window with a webview pointed at the entry (same origin → cookies/session shared via shared webview data store).
3. The site's own code mounts the widget into the leaf.
4. DetachChannel opens between source and leaf over Tauri IPC.
5. Window manager registers the leaf for persistence and z-order.

**M2 (same-realm float, in-browser / no Tauri):**
1. Source page calls `widget.detach()` → `documentPictureInPicture.requestWindow()`.
2. Nodes are **moved** (not cloned) into the PiP document; listeners and framework state survive because the realm is shared.
3. Stylesheets are copied into the PiP document.
4. Single window, single process — accepted limit.

**M3 (remote view / live mirror — Tier 0, experimental):**
1. Browser identifies a candidate region (heuristics, §11).
2. **The widget keeps running in the source page** (hidden offscreen or left in place).
3. A leaf window presents a *projection* of it via one of:
   - **M3a — Full-page isolation:** load the full source URL in the leaf webview (cookies shared), inject CSS to hide everything except the target selector. Two live instances; state divergence handled best-effort.
   - **M3b — DOM-mirror + event forwarding:** serialize the subtree's markup + computed styles into the leaf; forward all input events from the leaf back to the still-running original; stream DOM mutations forward. Essentially "VNC for a widget."
4. The leaf is a synchronized view, never the original object.

### 2.3 Process model

Each native leaf (M1/M3) runs in its own webview process — a crash isolates correctly. **This isolation is precisely why M1 must re-mount and M3 must project: nothing live crosses the boundary.** M2 deliberately stays in-process to preserve liveness.

---

## 3. Widget Manifest Specification

Extends the W3C Web App Manifest with `detachable_widgets`. **Key v0.2 change: `selector` alone is insufficient for interactive widgets — an `entry` is required for M1.**

### 3.1 Schema

```json
{
  "name": "TradingApp",
  "detachable_widgets": [
    {
      "id": "stock-ticker",
      "entry": "/widgets/ticker",
      "selector": "#widget-ticker",
      "mechanism": "remount",
      "title": "Live Ticker",
      "icon": "/icons/ticker.svg",
      "min_size": { "width": 280, "height": 120 },
      "preferred_size": { "width": 400, "height": 200 },
      "max_size": { "width": 800, "height": 600 },
      "resizable": true,
      "always_on_top": false,
      "state_channel": "ticker-sync",
      "requires": ["auth", "websocket"],
      "orphan_policy": "persist",
      "snap_zones": ["right", "bottom"]
    }
  ]
}
```

### 3.2 Field reference (deltas from v0.1 in **bold**)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| **`entry`** | string | **Yes for `remount`** | URL or registered mount key that renders the widget standalone. Same origin. |
| `selector` | string | Yes for `mirror`/`pip` | CSS selector locating the widget for M2/M3 |
| **`mechanism`** | enum | No | `remount` (M1) \| `pip` (M2) \| `mirror` (M3) \| `auto` (default: best available) |
| `title` | string | Yes | Title-bar name |
| `icon` | string | No | Title-bar / taskbar icon |
| `min_size`/`preferred_size`/`max_size` | `{width,height}` | No | Dimensions in CSS px |
| `resizable` / `always_on_top` | boolean | No | Defaults: true / false |
| `state_channel` | string | No | Named bidirectional sync channel |
| `requires` | string[] | No | Capabilities: auth, websocket, camera, … |
| `orphan_policy` | enum | No | `persist` \| `snapshot` \| `close` (default persist) |
| `snap_zones` | string[] | No | top, right, bottom, left |

### 3.3 `mechanism` (replaces v0.1 `detach_behavior`)

- **`remount` (M1)** — leaf loads `entry`; site re-hydrates; full bidirectional sync. **Recommended.**
- **`pip` (M2)** — same-realm Document PiP. In-browser fallback; single window.
- **`mirror` (M3)** — projection of the still-running original. Used for Tier 0 and read-mostly widgets. **Experimental.**
- **`auto`** — browser picks the best available given the site's tier and runtime (native vs in-browser).

`detach_behavior: clone|move` from v0.1 is **removed** — both were unimplementable across processes (`move` of an iframe also reloads it per HTML spec, losing state).

### 3.4 orphan_policy

- **persist** — leaf stays alive on source navigation; reconnects on return (M1: trivially; M3: the source projection target is gone, so leaf falls back to last snapshot until reconnect).
- **snapshot** — freeze to static snapshot.
- **close** — close with the source tab.

---

## 4. HTML Attribute API (Tier 1)

For self-contained widgets only. Tier 1 elements **must be safe to re-mount or PiP** — i.e. a Web Component or an element whose framework supports portal/teleport. Plain framework subtrees are *not* Tier-1-eligible and fall back to M3 mirror.

```html
<section
  detachable
  detach-entry="/widgets/ticker"
  detach-title="Stock Ticker"
  detach-mechanism="remount"
  detach-channel="ticker-sync"
  detach-min-width="280" detach-min-height="120"
  detach-preferred-width="400" detach-preferred-height="200"
  detach-orphan="persist"
>…</section>
```

**Affordances on `[detachable]`:** grip handle (hover, top-right), right-click → "Detach to desktop", `Ctrl/Cmd+Shift+D`, drag grip outside the browser to spawn.

---

## 5. Web Component API (Tier 3)

```html
<detachable-widget entry="/widgets/chat" channel="chat-sync" mechanism="remount" icon="/icons/chat.svg">
  <my-chat-component slot="content" />
</detachable-widget>
```

### 5.1 Events
`ondetach {leafId, windowBounds}` · `onreattach {leafId, finalState}` · `onstatechange {channelName, data}` · `onorphan {policy, lastState}` · `onreconnect {leafId, timeSinceOrphan}`

### 5.2 Programmatic API

```typescript
const widget = document.querySelector("detachable-widget");
const leaf = await widget.detach({
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  screen: screenDetails.screens[1]          // W3C Window Management
});
await widget.dock();
widget.isDetached;   // boolean
widget.leafWindow;   // Window | null
widget.mechanism;    // "remount" | "pip" | "mirror" — resolved at detach time
```

---

## 6. DetachChannel — State Synchronization

A same-origin cross-window **message bus**, not a magic state replicator. The application defines *what* syncs; the channel only transports it. (This is the honest framing: generic cross-instance app-state sync is the distributed-state problem and is not solvable for the app.)

### 6.1 Source / Leaf — same as v0.1

```typescript
const channel = new DetachChannel("ticker-sync");
channel.ondetach = (leaf) => leaf.postState({ symbols: ["AAPL","GOOG"], interval: 5000 });
channel.onstatechange = (e) => updatePortfolio(e.data.selectedSymbol);
channel.broadcastState({ marketStatus: "open" });
channel.postStateTo(leafId, { alert: "AAPL > 200" });

// Leaf:
const ch = DetachChannel.fromLeaf();
ch.onstate = (s) => renderTicker(s.symbols, s.interval);
ch.postState({ selectedSymbol: "AAPL" });
ch.onorphan = () => showReconnectingBanner();
ch.onreconnect = () => hideReconnectingBanner();
```

### 6.2 Transport
- **Primary (native):** Tauri IPC (Rust event bus between webview processes).
- **In-browser:** `BroadcastChannel` (same-origin, structured-clone payloads).
- **Fallback:** SharedWorker for one-to-many fan-out with shared compute.

### 6.3 Payload constraint
Only **structured-cloneable** data crosses the channel — no functions, DOM nodes, or sockets. WebSockets are *not* shared; each side opens its own (per `requires`), or the source proxies messages over the channel.

### 6.4 Auth & session sharing
Leaves inherit same-origin cookies (incl. HttpOnly), Service Worker registrations, IndexedDB/localStorage — **only because M1/M3a load the real origin URL in a webview sharing the data store.** Verified feasible: Tauri windows sharing a webview data directory share the same-origin cookie jar (WKWebsiteDataStore / WebView2 user-data-folder / WebKitGTK shared context). This is the technical reason M1 is the recommended path.

---

## 7. Widget Lifecycle

```
embedded → detaching → detached → docking → embedded
                         ↓
                      orphaned → reconnected → detached
                         ↓
                       closed
```

| State | Description |
|-------|-------------|
| embedded | In source page |
| detaching | Spawning leaf (M1: loading entry; M2: PiP request; M3: building projection) |
| detached | In its own window, channel active |
| orphaned | Source navigated away |
| reconnected | Source returned, channel re-established |
| docking | Closing leaf / docking |
| closed | Leaf destroyed |

Session persistence schema is unchanged from v0.1, plus a `mechanism` field per leaf.

---

## 8. Security Model

- **Same-origin enforcement** — leaves load only same-origin content; channels scoped to origin.
- **Permission inheritance, no escalation** — natural for M1/M3a (real same-origin load).
- **Process isolation** — each native leaf isolated.
- **CSP compliance** — leaves honor the source CSP. **M3b note:** DOM-mirror + event forwarding is an injection-class technique; it must run in an isolated content world and respect CSP, and is the single largest security-review surface in the project.
- **Static manifests** — no prompt-injection surface.

---

## 9. Technology Stack

| Layer | Technology | Rationale / change |
|-------|-----------|--------------------|
| Native Shell | Tauri v2 | Multi-window, Rust IPC, small binaries |
| Engine | **System WebView (primary)** | Servo/Verso cannot render Gmail/Slack reliably in 2026; **removed from critical path** |
| Engine (later) | Servo via Verso | Experimental track only |
| Window Manager | Custom Rust + WinBox.js concepts | OS-level + in-page |
| State Sync | Tauri IPC + BroadcastChannel + SharedWorker | Transport only |
| Projection (M3) | Custom: CSS isolation (M3a) / MutationObserver + event replay (M3b) | New, experimental |
| Build | Cargo + pnpm + Vite | — |
| Testing | WebDriver + Playwright | E2E + visual regression |

---

## 10. Website Compatibility Tiers

| Tier | Effort | Mechanism | What works |
|------|--------|-----------|------------|
| **0** | Zero | **M3 mirror** (+ native PiP for `<video>`/`<audio>`) | **Experimental.** Media: reliable. Static/low-interactivity regions: best-effort read-mostly. Complex stateful widgets: degraded or refused — see §11/§13. |
| **1** | 5 min | M1 remount / M2 pip | Self-contained widgets & Web Components that declare an `entry` |
| **2** | 30 min | M1 remount | Manifest `detachable_widgets` with `entry` per widget |
| **3** | Hours+ | M1 + DetachChannel | Full bidirectional sync, custom element, orphan/reconnect |

---

## 11. Tier 0 R&D track — aggressive, honest

**Goal (unchanged ambition):** detach widgets from YouTube/Gmail/Slack with zero site changes. **Reality:** delivered by the Projection Engine (M3), graded by widget type.

**Detection (feasible):** classify candidate regions by size, position, ARIA role, mutation rate, and media presence. This part is tractable.

**Projection (the hard part), in increasing difficulty:**
1. **Media** (`<video>`/`<audio>`) → native PiP. **Solved today.**
2. **Static / read-mostly regions** (dashboards, tickers, feeds) → **M3a full-page isolation**: load the source URL in the leaf, CSS-isolate to the selector. Cost: a full second instance of the page per leaf (memory/CPU), possible layout reflow when isolating, and state divergence between instances. Acceptable for read-mostly content.
3. **Interactive widgets** (compose, chat) → **M3b DOM-mirror + event forwarding**: keep the original running in the source page, project its DOM into the leaf, forward input events back, stream mutations forward. This is "remote view for a widget." Cost: high engineering, latency on interaction, fragile against complex CSS/canvas/WebGL/shadow DOM, and a real security surface (§8).

**Honest failure modes the spec commits to handling, not hiding:**
- Canvas/WebGL/`<iframe>`/closed shadow DOM widgets → mirror degrades or is refused with a clear reason.
- State divergence in M3a → labeled "live mirror (read-mostly)" in the leaf chrome; writes routed back over an event bridge only when safe.
- Per-site memory of what works → a heuristics confidence score gates whether the affordance is even offered.

The point of keeping Tier 0 aggressive is to **push M3 as far as it can go and be explicit where it stops** — not to promise universal parity with cooperative widgets.

---

## 12. Implementation Roadmap (re-ordered for feasibility)

### Phase 1 — Native shell + M1 core (Weeks 1–4)
Tauri scaffold; multi-window management; manifest parser with **`entry` resolution**; **M1 remount** (leaf loads same-origin entry, cookies shared); GripHandle; drag-to-detach; session persistence. **Deliverable:** a cooperative demo app whose widget truly detaches and stays live.

### Phase 2 — DetachChannel + lifecycle (Weeks 5–8)
DetachChannel over Tauri IPC; BroadcastChannel/SharedWorker fallbacks; structured-clone payloads; orphan/reconnect; **M2 Document PiP** in-browser path. **Deliverable:** live stock ticker, bidirectional, with orphan/reconnect.

### Phase 3 — Window Manager (Weeks 9–12)
Edge snapping; z-order; minimize-to-tray; multi-monitor (W3C Window Management); layout presets; leaf taskbar; keyboard nav. **Deliverable:** full WM.

### Phase 4 — Tier 0 Projection Engine, experimental (Weeks 13–20, extended)
Media PiP first; then **M3a full-page isolation**; then **M3b DOM-mirror + event forwarding** as research; detection classifier; per-site confidence + override; clear "best-effort/read-mostly" UX. **Deliverable:** reliable media popout on any site + honest mirror for static regions; documented limits for the rest.

### Phase 5 — Ecosystem (Weeks 21–28)
DevTools panel; **manifest validator that warns when only `selector` is given for an interactive widget**; developer guide (all tiers, with §13 limits front-and-center); framework wrappers (React Portal / Vue Teleport helpers for M1); RFC publication; Servo experiment; benchmarks.

---

## 13. What Leaf cannot do (yet) — required reading for adopters

- **Cannot magically move a live, framework-owned widget into another process.** Interactive widgets need either re-mount (M1, needs a same-origin `entry`) or projection (M3, a synchronized view, not the original).
- **Cannot share live objects, closures, or sockets** across leaves — only structured-cloneable state over DetachChannel.
- **Cannot keep an `<iframe>` widget's state when reparenting** — the HTML spec reloads reparented iframes; use `entry` instead.
- **Tier 0 on complex apps is best-effort projection, not parity.** Canvas/WebGL/closed-shadow-DOM/cross-origin-iframe widgets may degrade or be refused, with the reason surfaced.
- **Servo is not on the critical path** for rendering real-world sites in 2026; system WebView is the production engine.

Stating these plainly is what makes the cooperative protocol credible enough for sites to adopt.

---

## 14. Claude Code Task Breakdown

### Bootstrap
| # | Task | Output | Est. |
|---|------|--------|------|
| B1 | Init Tauri v2 + Vite + TS | Scaffold builds/runs | 15m |
| B2 | Manifest TS types (with `entry`, `mechanism`) | `src/protocol/types.ts` | 15m |
| B3 | Manifest parser + **entry resolution** (Rust) | `src-tauri/src/manifest.rs` | 25m |
| B4 | Multi-window Tauri commands | `create_leaf_window`, `close_leaf`, `list_leaves` | 25m |

### Core protocol (M1)
| # | Task | Output | Est. |
|---|------|--------|------|
| C1 | M1 remount loader (leaf loads same-origin entry) | `src/protocol/Remount.ts` + Rust window cmd | 30m |
| C2 | DetachChannel (Rust IPC side) | `src-tauri/src/ipc.rs` | 30m |
| C3 | DetachChannel (TS client) + BroadcastChannel fallback | `src/protocol/DetachChannel.ts` | 30m |
| C4 | GripHandle component | `src/shell/GripHandle.tsx` | 20m |
| C5 | `<detachable-widget>` element + React Portal / Vue Teleport helpers | `src/components/DetachableWidget.ts` | 35m |
| C6 | Lifecycle state machine (orphan/reconnect) | — | 25m |
| C7 | **M2 Document PiP** in-browser path | `src/protocol/PipDetach.ts` | 25m |

### Window management
| # | Task | Output | Est. |
|---|------|--------|------|
| W1 | Edge snapping | `src/wm/SnapEngine.ts` | 25m |
| W2 | Z-order manager | `src/wm/ZOrderManager.ts` | 20m |
| W3 | Session persistence (+ `mechanism`) | `src-tauri/src/session.rs` | 20m |
| W4 | Leaf taskbar | `src/shell/LeafTaskbar.tsx` | 25m |
| W5 | Layout presets | — | 20m |
| W6 | Keyboard shortcuts | — | 15m |

### Tier 0 projection (experimental)
| # | Task | Output | Est. |
|---|------|--------|------|
| H0 | Media popout via native PiP | `src/projection/MediaPip.ts` | 25m |
| H1 | DOM classifier (Tier 0 detection) | `src-tauri/src/heuristics.rs` | 30m |
| H2 | **M3a full-page isolation** mirror | `src/projection/PageIsolate.ts` | 40m |
| H3 | **M3b DOM-mirror + event forwarding** (R&D) | `src/projection/DomMirror.ts` | 60m+ |
| H4 | Per-site confidence + manual override | — | 25m |

### Examples, docs
| # | Task | Output | Est. |
|---|------|--------|------|
| X1 | Trading dashboard (Tier 3, M1) | `examples/trading-dashboard/` | 45m |
| X2 | Simple-detach (Tier 1) | `examples/simple-detach/` | 15m |
| X3 | Manifest validator (warns on selector-only interactive widgets) | `packages/manifest-validator/` | 25m |
| X4 | E2E suite | `tests/e2e/` | 30m |
| D1–D4 | spec.md / getting-started / api-reference / README (lead with §13 limits) | `docs/` | 90m |

---

*Leaf v0.2.0 — Realistic Revision — June 2026*
*Cooperative protocol is ship-now; Tier 0 projection is an explicit, honest R&D track.*
