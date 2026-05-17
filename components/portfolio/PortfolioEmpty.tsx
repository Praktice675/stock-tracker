import AddTransactionDialog from "@/components/portfolio/AddTransactionDialog";

export default function PortfolioEmpty() {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ minHeight: "60vh" }}
    >
      <div
        className="flex flex-col items-center"
        style={{ gap: "16px", maxWidth: "420px", textAlign: "center" }}
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
          Start tracking your portfolio
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
          Add transactions to see your holdings, performance, and allocation.
        </p>
        <div style={{ marginTop: "12px" }}>
          <AddTransactionDialog variant="cta" />
        </div>
      </div>
    </div>
  );
}
