import { ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import CheckoutSuccessToast from "@/components/CheckoutSuccessToast";
import DashboardChrome from "@/components/DashboardChrome";
import AddTransactionDialog from "@/components/portfolio/AddTransactionDialog";
import AllocationChart from "@/components/portfolio/AllocationChart";
import BrokerageConnectMenu from "@/components/portfolio/BrokerageConnectMenu";
import BrokerageHoldings from "@/components/portfolio/BrokerageHoldings";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import MetricsStrip from "@/components/portfolio/MetricsStrip";
import PortfolioChart from "@/components/portfolio/PortfolioChart";
import PortfolioEmpty from "@/components/portfolio/PortfolioEmpty";
import PortfolioHeroCards, {
  type HeroData,
  type HeroDistributionSegment,
  type HeroSnapshot,
  type UnrealizedPosition,
} from "@/components/portfolio/PortfolioHeroCards";
import TransactionsList from "@/components/portfolio/TransactionsList";
import { StaggerContainer, StaggerItem } from "@/components/ui/Stagger";
import { getBrokerageData } from "@/lib/portfolio/brokerage";
import { getPortfolioData } from "@/lib/portfolio/compute";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [data, brokerage, profile] = await Promise.all([
    getPortfolioData(),
    getBrokerageData(),
    getUserProfile(),
  ]);

  // --- Hero data ----------------------------------------------------------
  // Total value = brokerage market value + manual transactions' market value.
  // We merge brokerage_positions and manual holdings into a single per-symbol
  // map for total + distribution so the same ticker held in both sources adds
  // up rather than appearing twice.
  const valueBySymbol = new Map<string, number>();

  for (const p of brokerage.positions) {
    if (!p.symbol) continue;
    const v =
      p.market_value != null
        ? p.market_value
        : (p.current_price ?? 0) * p.quantity;
    valueBySymbol.set(p.symbol, (valueBySymbol.get(p.symbol) ?? 0) + v);
  }
  for (const h of data.holdings) {
    valueBySymbol.set(
      h.ticker,
      (valueBySymbol.get(h.ticker) ?? 0) + h.marketValue,
    );
  }

  const totalValue = Array.from(valueBySymbol.values()).reduce(
    (s, v) => s + v,
    0,
  );

  // Top 4 + "Other" for Card A's distribution bar.
  const sortedByValue = Array.from(valueBySymbol.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const top4 = sortedByValue.slice(0, 4).map<HeroDistributionSegment>(
    ([symbol, marketValue]) => ({
      symbol,
      marketValue,
      percentOfTotal: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
    }),
  );
  const rest = sortedByValue.slice(4);
  const distribution: HeroDistributionSegment[] = [...top4];
  if (rest.length > 0 && totalValue > 0) {
    const restTotal = rest.reduce((s, [, v]) => s + v, 0);
    distribution.push({
      symbol: "Other",
      marketValue: restTotal,
      percentOfTotal: (restTotal / totalValue) * 100,
    });
  }

  // All snapshots, ascending. We slice this for "today" and "year-to-date"
  // baselines below — one DB round-trip instead of two.
  const snapshotsRes = await supabase
    .from("portfolio_snapshots")
    .select("total_value, taken_at")
    .eq("user_id", user.id)
    .order("taken_at", { ascending: true });

  const existingSnapshots: HeroSnapshot[] = ((snapshotsRes.data ?? []) as Array<{
    total_value: number | string;
    taken_at: string;
  }>).map((s) => ({
    totalValue: Number(s.total_value),
    takenAt: s.taken_at,
  }));

  // If the latest snapshot is missing / older than 5 minutes / disagrees with
  // the live computed total by more than $1, write a fresh point inline so
  // the chart's right edge tracks the actual current portfolio value
  // instead of an outdated snapshot from before the user added holdings.
  const allSnapshots: HeroSnapshot[] = [...existingSnapshots];
  const latestExisting = existingSnapshots[existingSnapshots.length - 1];
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const isStale =
    !latestExisting ||
    Date.now() - new Date(latestExisting.takenAt).getTime() > FIVE_MIN_MS ||
    Math.abs(latestExisting.totalValue - totalValue) > 1;
  if (isStale && totalValue > 0) {
    const nowIso = new Date().toISOString();
    const { error: snapErr } = await supabase
      .from("portfolio_snapshots")
      .insert({
        user_id: user.id,
        total_value: totalValue,
        taken_at: nowIso,
      });
    if (snapErr) {
      console.warn("portfolio snapshot insert on load failed:", snapErr.message);
    } else {
      allSnapshots.push({ totalValue, takenAt: nowIso });
    }
  }

  // Today's change (snapshots within the trailing 24h window).
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const todayPoints = allSnapshots.filter(
    (s) => new Date(s.takenAt).getTime() >= cutoffMs,
  );
  let todayChangeAbs = 0;
  let todayChangePct = 0;
  let hasTodayChange = false;
  if (todayPoints.length >= 2) {
    const first = todayPoints[0].totalValue;
    const latest = todayPoints[todayPoints.length - 1].totalValue;
    todayChangeAbs = latest - first;
    todayChangePct = first > 0 ? (todayChangeAbs / first) * 100 : 0;
    hasTodayChange = true;
  }

  // YTD change: compare liveTotal to the earliest pre-existing snapshot in
  // the current year (or earliest pre-existing overall if there's none yet
  // this year). We deliberately ignore the row we may have just inserted —
  // otherwise the baseline === the live total and YTD always reads 0%.
  //
  // "Building history" guard: if there are < 2 pre-existing snapshots, OR
  // they're all within $1 of each other (i.e. stuck/stale series), the YTD
  // baseline isn't meaningful, so suppress the number.
  const yearStartMs = new Date(new Date().getFullYear(), 0, 1).getTime();
  const ytdBaseline =
    existingSnapshots.find(
      (s) => new Date(s.takenAt).getTime() >= yearStartMs,
    ) ?? existingSnapshots[0];
  const existingValues = existingSnapshots.map((s) => s.totalValue);
  const existingSpread =
    existingValues.length === 0
      ? 0
      : Math.max(...existingValues) - Math.min(...existingValues);
  const hasMeaningfulHistory =
    existingSnapshots.length >= 2 && existingSpread > 1;

  let ytdChangeAbs = 0;
  let ytdChangePct = 0;
  let ytdLabel = "";
  let hasYtdChange = false;
  if (ytdBaseline && hasMeaningfulHistory) {
    ytdChangeAbs = totalValue - ytdBaseline.totalValue;
    ytdChangePct =
      ytdBaseline.totalValue > 0
        ? (ytdChangeAbs / ytdBaseline.totalValue) * 100
        : 0;
    const baseYear = new Date(ytdBaseline.takenAt).getFullYear();
    ytdLabel =
      baseYear === new Date().getFullYear() ? "this year" : "all time";
    hasYtdChange = true;
  }

  const hasAnyPosition =
    brokerage.positions.length > 0 || data.holdings.length > 0;

  // Unrealized P&L per holding (brokerage positions only — manual holdings
  // don't track avg_cost the same way). Filter out anything missing a price
  // or avg_cost so we don't render bars off bad data.
  const unrealizedPositions: UnrealizedPosition[] = brokerage.positions
    .filter(
      (p) =>
        typeof p.current_price === "number" &&
        typeof p.avg_cost === "number" &&
        typeof p.quantity === "number" &&
        p.quantity > 0,
    )
    .map((p) => {
      const currentPrice = p.current_price as number;
      const avgCost = p.avg_cost as number;
      const pnl = (currentPrice - avgCost) * p.quantity;
      const costBasis = avgCost * p.quantity;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return {
        symbol: p.symbol,
        quantity: p.quantity,
        currentPrice,
        avgCost,
        costBasis,
        pnl,
        pnlPct,
      };
    });
  const unrealizedTotalPnl = unrealizedPositions.reduce(
    (s, p) => s + p.pnl,
    0,
  );
  const unrealizedCostBasis = unrealizedPositions.reduce(
    (s, p) => s + p.costBasis,
    0,
  );
  const unrealizedPct =
    unrealizedCostBasis > 0
      ? (unrealizedTotalPnl / unrealizedCostBasis) * 100
      : 0;

  const heroData: HeroData = {
    hasAnyPosition,
    totalValue,
    todayChangeAbs,
    todayChangePct,
    hasTodayChange,
    ytdChangeAbs,
    ytdChangePct,
    ytdLabel,
    hasYtdChange,
    distribution,
    allSnapshots,
    unrealized: {
      positions: unrealizedPositions,
      totalPnl: unrealizedTotalPnl,
      costBasis: unrealizedCostBasis,
      pct: unrealizedPct,
    },
  };

  return (
    <DashboardChrome user={user}>
      <CheckoutSuccessToast />
      <StaggerContainer
        className="flex w-full flex-col overflow-y-auto"
        style={{ padding: "24px 24px 48px" }}
      >
        <StaggerItem
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                marginBottom: "6px",
              }}
            >
              Welcome back, {profile?.displayName ?? "there"}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Here&apos;s where your portfolio stands today.
            </p>
          </div>
          <div
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <button
              type="button"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--text-primary)",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              All time
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            <BrokerageConnectMenu />
          </div>
        </StaggerItem>

        <StaggerItem>
          <PortfolioHeroCards data={heroData} />
        </StaggerItem>

        <StaggerItem>
          <BrokerageHoldings
            positions={brokerage.positions}
            hasConnections={brokerage.hasActiveConnections}
          />
        </StaggerItem>

        {data.hasAnyTransaction ? (
          <StaggerItem>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: "16px" }}
            >
              <h1
                className="font-mono uppercase"
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                Portfolio
              </h1>
              <AddTransactionDialog />
            </div>

            <MetricsStrip totals={data.totals} />

            <div style={{ marginTop: "24px" }}>
              <PortfolioChart hasTransactions={data.hasAnyTransaction} />
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: "minmax(0, 65%) minmax(0, 35%)",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              <HoldingsTable holdings={data.holdings} />
              <AllocationChart holdings={data.holdings} />
            </div>

            <div style={{ marginTop: "24px" }}>
              <div
                className="flex items-center"
                style={{
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <h2
                  className="font-mono uppercase"
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.25em",
                    color: "var(--text-muted)",
                    margin: 0,
                  }}
                >
                  Recent Transactions
                </h2>
              </div>
              <TransactionsList transactions={data.recentTransactions} />
            </div>
          </StaggerItem>
        ) : !brokerage.hasActiveConnections ? (
          <StaggerItem>
            <PortfolioEmpty />
          </StaggerItem>
        ) : null}
      </StaggerContainer>
    </DashboardChrome>
  );
}