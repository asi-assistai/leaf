import type { DetachableWidgetManifest } from "../protocol/types";
import { StockTickerSource } from "../widgets/StockTickerSource";

interface SourceShellProps {
  manifest: DetachableWidgetManifest;
}

export function SourceShell({ manifest }: SourceShellProps) {
  const ticker = manifest.detachable_widgets.find((widget) => widget.id === "stock-ticker");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Leaf M1 Demo</p>
          <h1>{manifest.name}</h1>
        </div>
        <div className="address-pill">leaf://cooperative-remount</div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <h2>Detachable Widgets</h2>
          <p>
            This slice implements M1 remount: the leaf loads a same-origin widget entry and syncs
            state over a structured message channel.
          </p>
          <div className="tier-list">
            <span className="tier active">M1 remount</span>
            <span className="tier">M2 PiP later</span>
            <span className="tier">M3 mirror later</span>
          </div>
        </aside>

        <section className="content-area">
          {ticker ? (
            <StockTickerSource widget={ticker} />
          ) : (
            <section className="notice">
              <h2>No stock ticker manifest entry</h2>
              <p>Add a widget with id <code>stock-ticker</code> to <code>/leaf-manifest.json</code>.</p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
