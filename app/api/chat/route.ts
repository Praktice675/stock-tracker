import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { TOOLS, executeTool } from "@/lib/ai/tools";
import {
  getPortfolioContext,
  portfolioContextToPrompt,
} from "@/lib/chat/portfolio-context";
import { getUserPlan } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITERATIONS = 5;
const FREE_DAILY_MESSAGE_LIMIT = 10;

const SYSTEM_PROMPT_BASE_PLUS = `You are Pulse, an AI assistant embedded in a stock dashboard called Pulse. You help users understand their portfolio and the markets.

Tools available — use them aggressively to ground your answers in real data:
- get_portfolio_summary: user's holdings, P&L, allocation
- get_watchlist: tickers they're tracking
- get_quote: current price for any ticker
- get_stats: fundamentals for a ticker
- get_news: recent news for a ticker
- get_earnings_calendar: upcoming earnings in their watchlist
- get_market_indices: SPY/QQQ/DIA/VIX
- get_historical_performance: how a ticker or index performed over a specific period (1W/1M/3M/YTD/1Y). Use this when the user asks "how did X do last week/month/year", or wants to know performance trends.

Guidelines:
- ALWAYS use tools when the user asks about anything specific — their portfolio, a stock's current price, news, etc. Never guess or use stale info.
- The user's portfolio summary is included below for quick reference. Treat it as the source of truth for what they hold — call get_portfolio_summary only if you need a recompute.
- Be concise. 2-4 sentences for most answers. Bullet points for lists.
- Use plain numbers like "$120,000" not "$120K" unless space-constrained.
- When discussing the user's positions, reference their actual data: "Your AAPL position is up 14% from your $20 avg cost" not generic "AAPL is up."
- For questions about historical performance (last week, last month, etc.), use get_historical_performance, not get_quote (which only shows today).
- If asked for investment advice, give educational framing (factors to consider) not directives ("buy" / "sell").
- If a tool fails or returns no data, say so honestly. Don't make things up.
- Format dollar amounts with commas, percentages with 1-2 decimals.`;

const SYSTEM_PROMPT_BASE_FREE = `You are Pulse, an AI assistant embedded in a stock dashboard called Pulse.

You can answer general investing and market questions — concepts (P/E, dividends, options, ETFs), how-tos, and educational background.

Limits on this conversation:
- You do NOT have access to the user's portfolio data or live ticker tools right now.
- If the user asks about their specific positions, performance, P&L, sector exposure, or live prices, briefly explain that portfolio-aware analysis and live data lookups are Pulse Plus features, and offer to answer the educational/conceptual side of their question.
- Never invent specific dollar amounts, prices, or P&L numbers for the user — you genuinely don't know them in this conversation.

Style:
- Be concise. 2-4 sentences for most answers. Bullet points for lists.
- If asked for investment advice, give educational framing (factors to consider), never directives ("buy" / "sell").`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI is not configured. Add ANTHROPIC_API_KEY to your environment.",
      },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getUserPlan();
  const isPlus = plan.plan === "plus";

  // Daily quota gate — applies to Free only. Plus subscribers are unlimited.
  // Counter increments still happen below for analytics (so we track active
  // Plus usage too), but the gate above only fires for Free.
  const today = new Date().toISOString().slice(0, 10);
  if (!isPlus) {
    const { data: usageRow, error: usageErr } = await supabase
      .from("chat_usage")
      .select("message_count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();
    if (usageErr) {
      console.warn("/api/chat: usage read failed:", usageErr.message);
    }
    const currentCount = usageRow?.message_count ?? 0;
    if (currentCount >= FREE_DAILY_MESSAGE_LIMIT) {
      return NextResponse.json(
        {
          error: "Daily limit reached",
          limit: FREE_DAILY_MESSAGE_LIMIT,
          upgrade: true,
        },
        { status: 429 },
      );
    }
  }

  const body = await request.json().catch(() => null);
  const inputMessages = body?.messages;
  if (!Array.isArray(inputMessages)) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = inputMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : m.content,
  }));

  // System prompt:
  //   - Plus: portfolio data injected up-front + all tools enabled
  //   - Free: no portfolio data, no tools, polite gate-pitch for portfolio Qs
  const todayIso = new Date().toISOString().slice(0, 10);
  let systemPrompt: string;
  if (isPlus) {
    let portfolioBlock = "";
    try {
      const ctx = await getPortfolioContext();
      if (ctx) {
        portfolioBlock = `\n\n--- USER PORTFOLIO ---\n${portfolioContextToPrompt(ctx)}\n--- END PORTFOLIO ---`;
      }
    } catch (err) {
      console.warn(
        "/api/chat: portfolio context build failed (continuing without):",
        err instanceof Error ? err.message : err,
      );
    }
    systemPrompt =
      SYSTEM_PROMPT_BASE_PLUS +
      portfolioBlock +
      `\n\nToday's date is ${todayIso}.`;
  } else {
    systemPrompt =
      SYSTEM_PROMPT_BASE_FREE + `\n\nToday's date is ${todayIso}.`;
  }

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: systemPrompt,
        // Only Plus gets tool access — Free conversations are concept-only.
        ...(isPlus ? { tools: TOOLS } : {}),
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
        await incrementUsage(user.id, today);
        return NextResponse.json({ messages });
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tool) => {
          const result = await executeTool(tool.name, tool.input, supabase);
          return {
            type: "tool_result" as const,
            tool_use_id: tool.id,
            content: JSON.stringify(result),
          };
        }),
      );

      messages.push({ role: "user", content: toolResults });
    }

    // Loop budget exhausted — return what we have so the user sees something.
    await incrementUsage(user.id, today);
    return NextResponse.json({
      messages,
      warning: "Tool-use iteration limit reached.",
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI error: ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    console.error("/api/chat error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}

// Best-effort quota increment. Runs after a successful Anthropic call so a
// failed call doesn't burn quota. Service role required because RLS only
// grants users SELECT on chat_usage; INSERTs/UPDATEs are server-write only.
//
// Race tolerance: two concurrent requests can both read N and write N+1
// (instead of N+2) in the worst case. That means the soft ceiling can leak
// by a request or two during bursts — acceptable for a 100/day quota.
async function incrementUsage(userId: string, usageDate: string) {
  try {
    const service = createServiceClient();
    // Service client has no Database generic so query results widen to never.
    // Cast through `unknown` for the row reads and writes.
    const table = service.from("chat_usage") as unknown as {
      select: (
        cols: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { message_count: number } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };

    const { data: existing } = await table
      .select("message_count")
      .eq("user_id", userId)
      .eq("usage_date", usageDate)
      .maybeSingle();
    const next = (existing?.message_count ?? 0) + 1;
    const { error } = await table.upsert(
      {
        user_id: userId,
        usage_date: usageDate,
        message_count: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,usage_date" },
    );
    if (error) {
      console.warn("/api/chat: usage upsert failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "/api/chat: incrementUsage failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
