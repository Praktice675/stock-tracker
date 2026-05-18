import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardChrome from "@/components/DashboardChrome";
import NewsFeed from "@/components/news/NewsFeed";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: rows } = await supabase
    .from("watchlist_items")
    .select("ticker, position")
    .order("position", { ascending: true });

  const tickers = (rows ?? [])
    .map((r) => (typeof r.ticker === "string" ? r.ticker : null))
    .filter((t): t is string => !!t);

  return (
    <DashboardChrome user={user}>
      <div
        className="flex w-full flex-col overflow-y-auto"
        style={{ padding: "24px 24px 48px" }}
      >
        {tickers.length === 0 ? (
          <EmptyWatchlist />
        ) : (
          <NewsFeed watchlistTickers={tickers} />
        )}
      </div>
    </DashboardChrome>
  );
}

function EmptyWatchlist() {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ minHeight: "60vh" }}
    >
      <div
        className="flex flex-col items-center"
        style={{ gap: "16px", maxWidth: "440px", textAlign: "center" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "22px",
            fontWeight: 800,
            letterSpacing: "-0.015em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          No watchlist yet
        </h1>
        <p
          className="text-text-muted"
          style={{
            fontSize: "13px",
            letterSpacing: "-0.015em",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Add stocks to your watchlist to see news here.
        </p>
        <Link
          href="/dashboard"
          className="font-mono font-bold uppercase"
          style={{
            marginTop: "12px",
            padding: "14px 28px",
            fontSize: "13px",
            letterSpacing: "0.2em",
            backgroundColor: "var(--accent)",
            color: "rgb(var(--color-black))",
            border: "none",
            borderRadius: "var(--border-radius)",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Go to Markets
        </Link>
      </div>
    </div>
  );
}
