import type { DetachableWidgetDefinition } from "./types";
import type { LeafWindowRef, WindowAdapter } from "./WindowAdapter";

export interface RemountRequest {
  widget: DetachableWidgetDefinition;
  channel: string;
}

export interface RemountResult {
  leafId: string;
  url: string;
  window: LeafWindowRef;
}

export class RemountController {
  constructor(private readonly adapter: WindowAdapter, private readonly origin = window.location.origin) {}

  open(request: RemountRequest): RemountResult {
    if (!request.widget.entry) {
      throw new Error(`Widget ${request.widget.id} cannot remount without an entry.`);
    }

    const leafId = `leaf-${request.widget.id}-${Date.now()}`;
    const url = this.createLeafUrl(request.widget, request.channel, leafId);
    const size = request.widget.preferred_size ?? { width: 420, height: 320 };

    const leafWindow = this.adapter.openLeaf({
      url,
      label: leafId,
      title: request.widget.title,
      width: size.width,
      height: size.height,
      resizable: request.widget.resizable ?? true,
    });

    return { leafId, url, window: leafWindow };
  }

  createLeafUrl(widget: DetachableWidgetDefinition, channel: string, leafId: string): string {
    if (!widget.entry) {
      throw new Error(`Widget ${widget.id} cannot remount without an entry.`);
    }

    const url = new URL(widget.entry, this.origin);
    url.searchParams.set("mode", "leaf");
    url.searchParams.set("widgetId", widget.id);
    url.searchParams.set("channel", channel);
    url.searchParams.set("leafId", leafId);
    return `${url.pathname}${url.search}${url.hash}`;
  }
}
