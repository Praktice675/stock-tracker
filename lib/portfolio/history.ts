import { fetchHistoricalCloses, fetchYahooQuote } from "@/lib/yahooFinance";

export type Timeframe = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export type HistoryPoint = {
  date: string;
  portfolioValue: number;
  spyValue: number;
};

export type PortfolioTransaction = {
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  executed_at: string;
};

const TF_DAYS: Record<Exclude<Timeframe, "YTD" | "ALL">, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

const FETCH_CONCURRENCY = 5;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Last close at-or-before `dateStr` for a ticker using a precomputed sorted
// (date, close) index. Returns null if no prior data point exists.
function priceOn(
  dates: string[] | undefined,
  closes: number[] | undefined,
  dateStr: string,
): number | null {
  if (!dates || !closes || dates.length === 0) return null;
  if (dates[0] > dateStr) return null;
  let lo = 0;
  let hi = dates.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (dates[mid] <= dateStr) lo = mid;
    else hi = mid - 1;
  }
  return closes[lo];
}

export async function computePortfolioHistory(
  transactions: PortfolioTransaction[],
  timeframe: Timeframe,
): Promise<{ history: HistoryPoint[]; firstDate: string }> {
  const todayStart = startOfDay(new Date());
  const todayStr = isoDate(todayStart);

  if (transactions.length === 0) {
    return { history: [], firstDate: todayStr };
  }

  const txAsc = [...transactions].sort(
    (a, b) =>
      new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );
  const earliestTxDate = startOfDay(new Date(txAsc[0].executed_at));

  // Range start from timeframe.
  let rangeStart: Date;
  if (timeframe === "ALL") {
    rangeStart = earliestTxDate;
  } else if (timeframe === "YTD") {
    rangeStart = new Date(todayStart.getFullYear(), 0, 1);
  } else {
    rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - TF_DAYS[timeframe]);
  }

  // Chart starts at max(earliestTx, rangeStart) — no point showing $0 before
  // the user had any positions.
  let firstDate = earliestTxDate > rangeStart ? earliestTxDate : rangeStart;
  let firstDateStr = isoDate(firstDate);

  // If everything happened today, pull the chart start back one day so we
  // get at least two points: yesterday at $0, today at current value.
  if (firstDateStr === todayStr) {
    firstDate = new Date(firstDate);
    firstDate.setDate(firstDate.getDate() - 1);
    firstDateStr = isoDate(firstDate);
  }

  // Price data must extend back to whichever is earlier — earliestTx (to
  // replay history into the starting state) or firstDate (after the
  // extension above).
  const priceFrom = firstDate < earliestTxDate ? firstDate : earliestTxDate;
  const priceTo = todayStart;

  // SPY always included for comparison line.
  const tickerSet = new Set(txAsc.map((t) => t.ticker));
  tickerSet.delete("SPY");
  const allTickers = ["SPY", ...Array.from(tickerSet)];

  // Chunked-concurrency fetch.
  const priceMap = new Map<string, { date: string; close: number }[]>();
  for (let i = 0; i < allTickers.length; i += FETCH_CONCURRENCY) {
    const chunk = allTickers.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (t) => ({
        ticker: t,
        data: await fetchHistoricalCloses(t, priceFrom, priceTo),
      })),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.data) {
        priceMap.set(r.value.ticker, r.value.data);
      }
    }
  }

  // Per-ticker parallel arrays for fast binary search.
  const dateLookup = new Map<string, string[]>();
  const closeLookup = new Map<string, number[]>();
  for (const [t, arr] of priceMap.entries()) {
    dateLookup.set(
      t,
      arr.map((x) => x.date),
    );
    closeLookup.set(
      t,
      arr.map((x) => x.close),
    );
  }

  // Business-day calendar = union of dates any ticker has, within range.
  const dateSet = new Set<string>();
  for (const arr of priceMap.values()) {
    for (const p of arr) dateSet.add(p.date);
  }
  const dates = Array.from(dateSet)
    .filter((d) => d >= firstDateStr && d <= todayStr)
    .sort();

  // FIFO lot accounting per ticker.
  type Lot = { shares: number; price: number };
  const holdings = new Map<string, Lot[]>();
  let spyShares = 0;
  let txIdx = 0;

  function applyTx(tx: PortfolioTransaction): boolean {
    if (tx.type === "buy") {
      const lots = holdings.get(tx.ticker) ?? [];
      lots.push({ shares: tx.shares, price: tx.price });
      holdings.set(tx.ticker, lots);
    } else {
      // Defensive orphan-sell handling — never produce negative shares.
      const lots = holdings.get(tx.ticker) ?? [];
      const totalHeld = lots.reduce((s, l) => s + l.shares, 0);
      if (totalHeld <= 0 || totalHeld < tx.shares) {
        console.warn(
          `Orphan sell ignored: ${tx.ticker}, ${tx.shares} shares at ${tx.price} on ${tx.executed_at}` +
            (totalHeld > 0 ? ` (only ${totalHeld} held)` : ""),
        );
        return false;
      }
      let toRemove = tx.shares;
      while (toRemove > 0 && lots.length > 0) {
        const oldest = lots[0];
        if (oldest.shares <= toRemove) {
          toRemove -= oldest.shares;
          lots.shift();
        } else {
          oldest.shares -= toRemove;
          toRemove = 0;
        }
      }
      if (lots.length > 0) holdings.set(tx.ticker, lots);
      else holdings.delete(tx.ticker);
    }

    // SPY cash-flow mirror: only for txs that actually affected holdings.
    const txDateStr = isoDate(new Date(tx.executed_at));
    const spyPrice = priceOn(
      dateLookup.get("SPY"),
      closeLookup.get("SPY"),
      txDateStr,
    );
    if (spyPrice && spyPrice > 0) {
      const cash = tx.shares * tx.price;
      if (tx.type === "buy") spyShares += cash / spyPrice;
      else spyShares -= cash / spyPrice;
    }
    return true;
  }

  // Pre-apply any transactions before the chart's start date so the chart
  // begins with the correct holdings already established.
  while (txIdx < txAsc.length) {
    const tx = txAsc[txIdx];
    const txDateStr = isoDate(new Date(tx.executed_at));
    if (txDateStr < firstDateStr) {
      applyTx(tx);
      txIdx++;
    } else {
      break;
    }
  }

  const history: HistoryPoint[] = [];
  for (const date of dates) {
    // Apply any transactions falling on or before this date.
    while (txIdx < txAsc.length) {
      const tx = txAsc[txIdx];
      const txDateStr = isoDate(new Date(tx.executed_at));
      if (txDateStr <= date) {
        applyTx(tx);
        txIdx++;
      } else {
        break;
      }
    }

    let portfolioValue = 0;
    for (const [ticker, lots] of holdings.entries()) {
      const totalShares = lots.reduce((s, l) => s + l.shares, 0);
      const close = priceOn(
        dateLookup.get(ticker),
        closeLookup.get(ticker),
        date,
      );
      if (close !== null) portfolioValue += totalShares * close;
    }

    const spyClose = priceOn(
      dateLookup.get("SPY"),
      closeLookup.get("SPY"),
      date,
    );
    const spyValue = spyClose != null ? spyShares * spyClose : 0;

    history.push({ date, portfolioValue, spyValue });
  }

  // Ensure the chart always reflects today's state when the user has
  // transactions. This covers:
  //   - empty `dates` (no Yahoo data fetched at all)
  //   - intraday market (Yahoo's 1d series ends at yesterday's close)
  //   - all-today portfolios paired with the firstDate extension above
  const lastDate = history.length > 0 ? history[history.length - 1].date : null;
  if (transactions.length > 0 && lastDate !== todayStr) {
    while (txIdx < txAsc.length) {
      const tx = txAsc[txIdx];
      const txDateStr = isoDate(new Date(tx.executed_at));
      if (txDateStr <= todayStr) {
        applyTx(tx);
        txIdx++;
      } else {
        break;
      }
    }

    let portfolioValue = 0;
    for (const [ticker, lots] of holdings.entries()) {
      const totalShares = lots.reduce((s, l) => s + l.shares, 0);
      if (totalShares <= 0) continue;
      const q = await fetchYahooQuote(ticker);
      if (q) {
        portfolioValue += totalShares * q.price;
      } else {
        const close = priceOn(
          dateLookup.get(ticker),
          closeLookup.get(ticker),
          todayStr,
        );
        if (close !== null) portfolioValue += totalShares * close;
      }
    }

    let spyValue = 0;
    if (spyShares !== 0) {
      const sq = await fetchYahooQuote("SPY");
      if (sq) {
        spyValue = spyShares * sq.price;
      } else {
        const close = priceOn(
          dateLookup.get("SPY"),
          closeLookup.get("SPY"),
          todayStr,
        );
        if (close !== null) spyValue = spyShares * close;
      }
    }

    history.push({ date: todayStr, portfolioValue, spyValue });
  }

  return {
    history,
    firstDate: history.length > 0 ? history[0].date : firstDateStr,
  };
}
