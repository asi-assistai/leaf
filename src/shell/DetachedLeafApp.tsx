import type { DetachableWidgetManifest } from "../protocol/types";
import { StockTickerLeaf } from "../widgets/StockTickerLeaf";

interface DetachedLeafAppProps {
  manifest: DetachableWidgetManifest;
}

export function DetachedLeafApp({ manifest }: DetachedLeafAppProps) {
  const params = new URLSearchParams(window.location.search);
  const widgetId = params.get("widgetId");
  const channel = params.get("channel");
  const leafId = params.get("leafId");
  const widget = manifest.detachable_widgets.find((candidate) => candidate.id === widgetId);

  if (!widget || !channel || !leafId) {
    return (
      <main className="leaf-shell">
        <section className="notice">
          <h1>Leaf cannot mount</h1>
          <p>The remount URL is missing widget, channel, or leaf identity.</p>
        </section>
      </main>
    );
  }

  if (widget.id !== "stock-ticker") {
    return (
      <main className="leaf-shell">
        <section className="notice">
          <h1>Unknown widget</h1>
          <p>No demo renderer is registered for <code>{widget.id}</code>.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="leaf-shell">
      <StockTickerLeaf widget={widget} channelName={channel} leafId={leafId} />
    </main>
  );
}
