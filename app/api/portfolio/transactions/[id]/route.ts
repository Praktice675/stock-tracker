import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PatchBody = {
  shares?: unknown;
  price?: unknown;
  executed_at?: unknown;
  type?: unknown;
  notes?: unknown;
};

function numOrUndefined(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function strOrUndefined(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const shares = numOrUndefined(body.shares);
  if (shares !== undefined) update.shares = shares;
  const price = numOrUndefined(body.price);
  if (price !== undefined) update.price = price;
  const executedAt = strOrUndefined(body.executed_at);
  if (executedAt !== undefined) update.executed_at = executedAt;
  const notes = strOrUndefined(body.notes);
  if (notes !== undefined) update.notes = notes;
  if (body.type === "buy" || body.type === "sell") update.type = body.type;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_transactions")
    .update(update)
    .eq("id", id);

  // RLS handles the auth check — unauthorized rows simply don't match.
  if (error) {
    console.warn("PATCH transactions failed:", error.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.warn("DELETE transactions failed:", error.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
