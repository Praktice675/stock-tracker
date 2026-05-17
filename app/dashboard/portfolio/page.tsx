import { redirect } from "next/navigation";
import DashboardChrome from "@/components/DashboardChrome";
import AddTransactionDialog from "@/components/portfolio/AddTransactionDialog";
import AllocationChart from "@/components/portfolio/AllocationChart";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import MetricsStrip from "@/components/portfolio/MetricsStrip";
import PortfolioChart from "@/components/portfolio/PortfolioChart";
import PortfolioEmpty from "@/components/portfolio/PortfolioEmpty";
import TransactionsList from "@/components/portfolio/TransactionsList";
import { getPortfolioData } from "@/lib/portfolio/compute";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const data = await getPortfolioData();

  return (
    <DashboardChrome user={user}>
      <div
        className="flex w-full flex-col overflow-y-auto"
        style={{ padding: "24px 24px 48px" }}
      >
        {data.hasAnyTransaction ? (
          <>
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
          </>
        ) : (
          <PortfolioEmpty />
        )}
      </div>
    </DashboardChrome>
  );
}
