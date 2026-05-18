"use client";

import { useEffect, useState } from "react";

type Props = {
  ticker: string;
  size?: number;
};

export default function CompanyLogo({ ticker, size = 24 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/logo/${ticker}`);
        const data = await res.json();
        if (!cancelled) setUrl(data?.url ?? null);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (!url || errored) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "8px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-primary)",
          fontWeight: 700,
          fontSize: Math.max(10, Math.floor(size * 0.45)),
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          flexShrink: 0,
        }}
      >
        {ticker.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${ticker} logo`}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{
        width: size,
        height: size,
        borderRadius: "8px",
        background: "var(--bg-elevated)",
        objectFit: "contain",
        padding: "2px",
        flexShrink: 0,
      }}
    />
  );
}
