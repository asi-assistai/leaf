export interface TickerQuote {
  symbol: string;
  price: number;
  change: number;
}

export interface TickerState {
  selectedSymbol: string;
  quotes: TickerQuote[];
  marketStatus: "open" | "closed";
  updatedAt: number;
}

export const initialTickerState: TickerState = {
  selectedSymbol: "AAPL",
  marketStatus: "open",
  updatedAt: Date.now(),
  quotes: [
    { symbol: "AAPL", price: 214.32, change: 1.24 },
    { symbol: "MSFT", price: 487.15, change: -0.42 },
    { symbol: "NVDA", price: 143.88, change: 2.31 },
    { symbol: "TSLA", price: 182.63, change: -1.17 },
  ],
};

export function tickPrices(state: TickerState): TickerState {
  return {
    ...state,
    updatedAt: Date.now(),
    quotes: state.quotes.map((quote) => {
      const drift = (Math.random() - 0.47) * 1.8;
      const price = Math.max(1, quote.price + drift);
      return {
        ...quote,
        price,
        change: quote.change + drift / 5,
      };
    }),
  };
}
