import { useEffect, useMemo, useRef, useState } from "react";
import { DetachChannel } from "../protocol/DetachChannel";
import type { DetachableWidgetDefinition } from "../protocol/types";
import { initialTickerState, type TickerState } from "./tickerTypes";
import { TickerView } from "./TickerView";

interface StockTickerLeafProps {
  widget: DetachableWidgetDefinition;
  channelName: string;
  leafId: string;
}

export function StockTickerLeaf({ widget, channelName, leafId }: StockTickerLeafProps) {
  const [state, setState] = useState<TickerState>(initialTickerState);
  const latestState = useRef(state);
  const channel = useMemo(
    () =>
      new DetachChannel<TickerState>({
        channel: channelName,
        widgetId: widget.id,
        role: "leaf",
        leafId,
      }),
    [channelName, leafId, widget.id],
  );

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  useEffect(() => {
    const unsubscribe = channel.onMessage((message) => {
      if (message.kind === "source_state" && message.state) {
        setState(message.state);
      }
    });

    channel.post("leaf_ready");

    const close = () => channel.post("leaf_closed", latestState.current);
    window.addEventListener("pagehide", close);

    return () => {
      window.removeEventListener("pagehide", close);
      unsubscribe();
      channel.close();
    };
  }, [channel]);

  function selectSymbol(symbol: string) {
    const nextState = { ...state, selectedSymbol: symbol, updatedAt: Date.now() };
    setState(nextState);
    channel.post("leaf_state", nextState);
  }

  return (
    <section className="widget-frame leaf-widget">
      <div className="widget-heading">
        <div>
          <p className="eyebrow">Detached Leaf</p>
          <h1>{widget.title}</h1>
        </div>
        <span className="status-badge">M1 remount</span>
      </div>
      <TickerView state={state} onSelectSymbol={selectSymbol} surface="leaf" />
    </section>
  );
}
