import { assertValidManifest, type DetachableWidgetManifest } from "./types";

export async function loadManifest(path = "/leaf-manifest.json"): Promise<DetachableWidgetManifest> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Leaf manifest: ${response.status} ${response.statusText}`);
  }

  const manifest = await response.json();
  assertValidManifest(manifest);
  return manifest;
}
