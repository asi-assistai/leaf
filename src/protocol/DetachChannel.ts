export type DetachChannelRole = "source" | "leaf";

export type DetachMessageKind = "leaf_ready" | "source_state" | "leaf_state" | "leaf_closed";

export interface DetachMessage<TState> {
  kind: DetachMessageKind;
  channel: string;
  widgetId: string;
  role: DetachChannelRole;
  senderId: string;
  leafId?: string;
  state?: TState;
  sentAt: number;
}

export type DetachMessageHandler<TState> = (message: DetachMessage<TState>) => void;

export interface DetachChannelOptions {
  channel: string;
  widgetId: string;
  role: DetachChannelRole;
  leafId?: string;
}

export class DetachChannel<TState> {
  private readonly broadcast: BroadcastChannel;
  private readonly senderId = crypto.randomUUID();
  private readonly listeners = new Set<DetachMessageHandler<TState>>();

  constructor(private readonly options: DetachChannelOptions) {
    this.broadcast = new BroadcastChannel(options.channel);
    this.broadcast.addEventListener("message", this.handleMessage);
  }

  post(kind: DetachMessageKind, state?: TState): void {
    const message: DetachMessage<TState> = {
      kind,
      state,
      channel: this.options.channel,
      widgetId: this.options.widgetId,
      role: this.options.role,
      leafId: this.options.leafId,
      senderId: this.senderId,
      sentAt: Date.now(),
    };
    this.broadcast.postMessage(message);
  }

  onMessage(handler: DetachMessageHandler<TState>): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  close(): void {
    this.broadcast.removeEventListener("message", this.handleMessage);
    this.broadcast.close();
    this.listeners.clear();
  }

  private readonly handleMessage = (event: MessageEvent<DetachMessage<TState>>) => {
    const message = event.data;
    if (!message || message.senderId === this.senderId) {
      return;
    }

    if (message.channel !== this.options.channel || message.widgetId !== this.options.widgetId) {
      return;
    }

    this.listeners.forEach((listener) => listener(message));
  };
}
