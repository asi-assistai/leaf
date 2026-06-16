import { useEffect, useState } from "react";
import { loadManifest } from "../protocol/ManifestLoader";
import type { DetachableWidgetManifest } from "../protocol/types";
import { DetachedLeafApp } from "./DetachedLeafApp";
import { SourceShell } from "./SourceShell";

export function App() {
  const [manifest, setManifest] = useState<DetachableWidgetManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLeaf = new URLSearchParams(window.location.search).get("mode") === "leaf";

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) {
    return (
      <main className="center-stage">
        <section className="notice">
          <h1>Leaf manifest failed</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!manifest) {
    return (
      <main className="center-stage">
        <section className="notice">
          <h1>Loading Leaf</h1>
          <p>Reading detachable widget manifest.</p>
        </section>
      </main>
    );
  }

  return isLeaf ? <DetachedLeafApp manifest={manifest} /> : <SourceShell manifest={manifest} />;
}
