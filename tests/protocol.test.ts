import { describe, expect, it } from "vitest";
import { RemountController } from "../src/protocol/RemountController";
import type { DetachableWidgetDefinition, DetachableWidgetManifest } from "../src/protocol/types";
import { validateManifest } from "../src/protocol/types";
import type { LeafWindowOptions, LeafWindowRef, WindowAdapter } from "../src/protocol/WindowAdapter";

class FakeWindowAdapter implements WindowAdapter {
  lastOptions: LeafWindowOptions | null = null;

  openLeaf(options: LeafWindowOptions): LeafWindowRef {
    this.lastOptions = options;
    return {
      id: options.label,
      focus: () => undefined,
      close: () => undefined,
    };
  }
}

describe("Leaf manifest validation", () => {
  it("accepts a remount widget with a same-origin entry", () => {
    const manifest: DetachableWidgetManifest = {
      name: "Demo",
      detachable_widgets: [
        {
          id: "stock-ticker",
          title: "Live Ticker",
          mechanism: "remount",
          entry: "/leaf/stock-ticker",
        },
      ],
    };

    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a remount widget without an entry", () => {
    const manifest = {
      name: "Demo",
      detachable_widgets: [
        {
          id: "stock-ticker",
          title: "Live Ticker",
          mechanism: "remount",
        },
      ],
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("detachable_widgets[0].entry is required when mechanism is remount.");
  });
});

describe("RemountController", () => {
  it("creates the leaf URL and delegates opening to the window adapter", () => {
    const widget: DetachableWidgetDefinition = {
      id: "stock-ticker",
      title: "Live Ticker",
      mechanism: "remount",
      entry: "/leaf/stock-ticker",
      preferred_size: { width: 460, height: 360 },
    };
    const adapter = new FakeWindowAdapter();
    const controller = new RemountController(adapter, "https://app.example.test");

    const result = controller.open({ widget, channel: "ticker-sync" });

    expect(result.url).toContain("/leaf/stock-ticker?mode=leaf&widgetId=stock-ticker");
    expect(result.url).toContain("channel=ticker-sync");
    expect(result.url).toContain(`leafId=${result.leafId}`);
    expect(adapter.lastOptions).toMatchObject({
      title: "Live Ticker",
      width: 460,
      height: 360,
      resizable: true,
    });
  });
});
