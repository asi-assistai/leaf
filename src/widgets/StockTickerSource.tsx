import { useEffect, useMemo, useState } from "react";
import { DetachChannel } from "../protocol/DetachChannel";
import { RemountController } from "../protocol/RemountController";
import type { DetachableWidgetDefinition } from "../protocol/types";
import { BrowserPopupWindowAdapter } from "../protocol/WindowAdapter";
import { initialTickerState, tickPrices, type TickerState } from "./tickerTypes";
import { TickerView } from "./TickerView";

interface StockTickerSourceProps {
  widget: DetachableWidgetDefinition;
}

export function StockTickerSource({ widget }: StockTickerSourceProps) {
  const channelName = widget.state_channel ?? `${widget.id}-sync`;
  const [state, setState] = useState<TickerState>(initialTickerState);
  const [error, setError] = useState<string | null>(null);
  const channel = useMemo(
    () => new DetachChannel<TickerState>({ channel: channelName, widgetId: widget.id, role: "source" }),
    [channelName, widget.id],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((current) => tickPrices(current));
    }, 1400);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = channel.onMessage((message) => {
      if (message.kind === "leaf_ready") {
        channel.post("source_state", state);
      }

      if (message.kind === "leaf_state" && message.state) {
        setState((current) => ({
          ...current,
          selectedSymbol: message.state?.selectedSymbol ?? current.selectedSymbol,
        }));
      }
    });

    return unsubscribe;
  }, [channel, state]);

  useEffect(() => {
    channel.post("source_state", state);
  }, [channel, state]);

  useEffect(() => () => channel.close(), [channel]);

  function detach() {
    setError(null);
    try {
      const controller = new RemountController(new BrowserPopupWindowAdapter());
      controller.open({ widget, channel: channelName });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function selectSymbol(symbol: string) {
    setState((current) => ({ ...current, selectedSymbol: symbol, updatedAt: Date.now() }));
  }

  return (
    <section className="widget-frame" id="widget-stock-ticker">
      <div className="widget-heading">
        <div>
          <p className="eyebrow">Cooperative Widget</p>
          <h2>{widget.title}</h2>
        </div>
        <button className="primary-button" type="button" onClick={detach}>
          Detach
        </button>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
      <TickerView state={state} onSelectSymbol={selectSymbol} surface="source" />
    </section>
  );
}
