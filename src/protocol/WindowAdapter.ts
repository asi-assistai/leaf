export interface LeafWindowOptions {
  url: string;
  label: string;
  title: string;
  width: number;
  height: number;
  resizable: boolean;
}

export interface LeafWindowRef {
  id: string;
  focus(): void;
  close(): void;
}

export interface WindowAdapter {
  openLeaf(options: LeafWindowOptions): LeafWindowRef;
}

export class BrowserPopupWindowAdapter implements WindowAdapter {
  openLeaf(options: LeafWindowOptions): LeafWindowRef {
    const features = [
      `popup=yes`,
      `width=${options.width}`,
      `height=${options.height}`,
      `resizable=${options.resizable ? "yes" : "no"}`,
    ].join(",");

    const popup = window.open(options.url, options.label, features);
    if (!popup) {
      throw new Error("Leaf window was blocked. Allow popups for this site and try again.");
    }

    popup.document.title = options.title;

    return {
      id: options.label,
      focus: () => popup.focus(),
      close: () => popup.close(),
    };
  }
}
