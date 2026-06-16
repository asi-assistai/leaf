# Leaf

Leaf is a prototype of a new kind of browser: a **detachable widget browser**.
Instead of treating a website as one indivisible tab, Leaf treats a website as a
set of useful surfaces that can become independent windows called **leaves**.

The long-term product idea is described in
[`leaf/LEAF-SPEC-v0.2.md`](leaf/LEAF-SPEC-v0.2.md): a user should be able to
detach a stock ticker, chat panel, video, dashboard, compose box, or other
widget from a page and place it anywhere on the desktop while keeping it
connected to the source site.

This repository currently implements the first practical slice:
**M1 cooperative remount**.

## Product Model

Leaf has three planned detachment mechanisms:

- **M1 cooperative remount:** the site declares a widget `entry`; Leaf opens that
  same-origin entry in a new window and the site re-renders the widget there.
- **M2 Document Picture-in-Picture:** a same-realm browser fallback for content
  that can live inside a PiP window.
- **M3 projection/mirror:** an experimental best-effort path for arbitrary sites
  where the original widget keeps running and the leaf displays a projection.

The current build focuses only on M1 because it is the credible foundation. It
does **not** try to clone or move live DOM subtrees across processes; that was
the unrealistic assumption corrected by the v0.2 spec.

## Current Demo

The app is a Vite + React + TypeScript demo shell with one detachable widget: a
live stock ticker.

The demo proves:

- manifest discovery from `/leaf-manifest.json`
- validation that `remount` widgets provide an `entry`
- a source page that owns the canonical widget state
- a detached same-origin popup window as a temporary browser-based leaf
- source-to-leaf and leaf-to-source state sync over `BroadcastChannel`
- a small window abstraction that can later be replaced by Tauri native windows

## Code Structure

- `src/protocol/types.ts` defines the v0.2 manifest types and validation rules.
- `src/protocol/ManifestLoader.ts` fetches and validates the manifest.
- `src/protocol/DetachChannel.ts` wraps `BroadcastChannel` as the first
  structured state-sync transport.
- `src/protocol/RemountController.ts` builds the leaf URL and asks a
  `WindowAdapter` to open it.
- `src/protocol/WindowAdapter.ts` contains the current browser-popup adapter and
  the interface a future Tauri adapter should implement.
- `src/shell/SourceShell.tsx` renders the main Leaf demo workspace.
- `src/shell/DetachedLeafApp.tsx` renders a detached leaf route from URL params.
- `src/widgets/StockTickerSource.tsx` owns ticker state and broadcasts updates.
- `src/widgets/StockTickerLeaf.tsx` remounts the ticker and sends user changes
  back to the source.
- `tests/protocol.test.ts` covers manifest validation and remount URL behavior.

## Detach Flow

1. The app loads `/leaf-manifest.json`.
2. The stock ticker manifest entry declares `mechanism: "remount"` and
   `entry: "/leaf/stock-ticker"`.
3. The user clicks **Detach** in the source widget.
4. `RemountController` creates a leaf URL with `mode=leaf`, `widgetId`,
   `channel`, and `leafId`.
5. `BrowserPopupWindowAdapter` opens that URL in a popup window.
6. `DetachedLeafApp` reads the URL params and renders `StockTickerLeaf`.
7. The leaf posts `leaf_ready`.
8. The source replies with `source_state`.
9. Ongoing source price updates and leaf symbol selections sync through
   `DetachChannel`.

## Future Native Path

The current popup adapter is intentionally temporary. In the native browser
build, the same `WindowAdapter` interface should be implemented by Tauri:

- open a real OS window instead of `window.open`
- point the webview at the same remount URL
- use Tauri IPC as the primary `DetachChannel` transport
- keep `BroadcastChannel` as an in-browser fallback
- persist leaf bounds and lifecycle state

## Run

```bash
pnpm install
pnpm dev
```

Then open the printed local URL and click **Detach** on the Live Ticker widget.
Allow popups for the local site if the browser blocks the leaf window.

The development server usually starts at:

```text
http://localhost:5173/
```

## Verify

```bash
pnpm test
pnpm build
```

## Current Limits

- No Tauri shell yet.
- No real native OS leaf windows yet.
- No M2 Document PiP path yet.
- No M3 arbitrary-site projection yet.
- No generic app-state replication; `DetachChannel` only transports structured
  data chosen by the application.
