import { redirect } from "next/navigation";
import DashboardChrome from "@/components/DashboardChrome";
import NewsClient, {
  type NewsTab,
} from "@/components/news/NewsClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Default "market news" basket used by the All tab and the Trending Stories
// sidebar. We avoid making this user-specific so the All tab feels like a
// market view rather than a personalised feed.
const ALL_TAB_TICKERS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "META",
  "GOOG",
  "AMZN",
];

function parseTab(raw: string | string[] | undefined): NewsTab {
  if (raw === "holdings") return "holdings";
  if (raw === "watchlist") return "watchlist";
  return "all";
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const [watchlistRes, positionsRes] = await Promise.all([
    supabase
      .from("watchlist_items")
      .select("ticker, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("brokerage_positions")
      .select("symbol")
      .eq("user_id", user.id),
  ]);

  const watchlistTickers = (watchlistRes.data ?? [])
    .map((r) => (typeof r.ticker === "string" ? r.ticker : null))
    .filter((t): t is string => !!t);
  const holdingsTickers = Array.from(
    new Set(
      (positionsRes.data ?? [])
        .map((r) => (typeof r.symbol === "string" ? r.symbol : null))
        .filter((t): t is string => !!t),
    ),
  );

  const params = await searchParams;
  const initialTab = parseTab(params?.tab);

  return (
    <DashboardChrome user={user}>
      <div
        className="flex w-full flex-col overflow-y-auto"
        style={{ padding: "24px 24px 48px" }}
      >
        <NewsClient
          initialTab={initialTab}
          allTickers={ALL_TAB_TICKERS}
          holdingsTickers={holdingsTickers}
          watchlistTickers={watchlistTickers}
        />
      </div>
    </DashboardChrome>
  );
}
