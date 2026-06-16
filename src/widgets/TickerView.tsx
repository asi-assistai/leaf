import type { TickerState } from "./tickerTypes";

interface TickerViewProps {
  state: TickerState;
  surface: "source" | "leaf";
  onSelectSymbol(symbol: string): void;
}

export function TickerView({ state, surface, onSelectSymbol }: TickerViewProps) {
  const selected = state.quotes.find((quote) => quote.symbol === state.selectedSymbol) ?? state.quotes[0];

  return (
    <div className="ticker-layout">
      <section className="ticker-summary">
        <div>
          <p className="eyebrow">{surface === "leaf" ? "Synced from source" : "Source of truth"}</p>
          <h3>{selected.symbol}</h3>
        </div>
        <strong>${selected.price.toFixed(2)}</strong>
        <span className={selected.change >= 0 ? "positive" : "negative"}>
          {selected.change >= 0 ? "+" : ""}
          {selected.change.toFixed(2)}%
        </span>
      </section>

      <div className="quote-list" role="list" aria-label="Ticker symbols">
        {state.quotes.map((quote) => (
          <button
            className={quote.symbol === state.selectedSymbol ? "quote-row selected" : "quote-row"}
            type="button"
            key={quote.symbol}
            onClick={() => onSelectSymbol(quote.symbol)}
          >
            <span>{quote.symbol}</span>
            <span>${quote.price.toFixed(2)}</span>
            <span className={quote.change >= 0 ? "positive" : "negative"}>
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>

      <footer className="ticker-footer">
        <span>Market {state.marketStatus}</span>
        <span>{new Date(state.updatedAt).toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}
