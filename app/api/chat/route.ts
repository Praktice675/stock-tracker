import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { TOOLS, executeTool } from "@/lib/ai/tools";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT_BASE = `You are Pulse, an AI assistant embedded in a stock dashboard called Pulse. You help users understand their portfolio and the markets.

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
- Be concise. 2-4 sentences for most answers. Bullet points for lists.
- Use plain numbers like "$120,000" not "$120K" unless space-constrained.
- When discussing the user's positions, reference their actual data: "Your AAPL position is up 14% from your $20 avg cost" not generic "AAPL is up."
- For questions about historical performance (last week, last month, etc.), use get_historical_performance, not get_quote (which only shows today).
- If asked for investment advice, give educational framing (factors to consider) not directives ("buy" / "sell").
- If a tool fails or returns no data, say so honestly. Don't make things up.
- Format dollar amounts with commas, percentages with 1-2 decimals.`;

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

  const systemPrompt =
    SYSTEM_PROMPT_BASE +
    `\n\nToday's date is ${new Date().toISOString().slice(0, 10)}.`;

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") {
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
