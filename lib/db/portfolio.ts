import { createClient } from '@/lib/supabase/client'

export type Transaction = {
  id: string
  ticker: string
  type: 'buy' | 'sell'
  shares: number
  price: number
  executed_at: string
  notes: string | null
}

export type Position = {
  ticker: string
  shares: number
  avg_cost: number
  total_invested: number
}

export async function getTransactions(): Promise<Transaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('id, ticker, type, shares, price, executed_at, notes')
    .order('executed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addTransaction(
  ticker: string,
  type: 'buy' | 'sell',
  shares: number,
  price: number,
  notes?: string,
): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('portfolio_transactions')
    .insert({ user_id: user.id, ticker, type, shares, price, notes })
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('portfolio_transactions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Used by the per-ticker × button in PortfolioTracker — the UI deletes a
// position as a whole, which under transactions semantics means clearing
// every transaction for that ticker.
export async function deletePositionByTicker(ticker: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('portfolio_transactions')
    .delete()
    .eq('ticker', ticker)
  if (error) throw error
}

// Compute current positions from transactions (FIFO-style avg cost)
export function computePositions(transactions: Transaction[]): Position[] {
  const positions = new Map<
    string,
    { shares: number; total_invested: number }
  >()

  // Process in chronological order (oldest first)
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  )

  for (const tx of sorted) {
    const current = positions.get(tx.ticker) ?? {
      shares: 0,
      total_invested: 0,
    }
    if (tx.type === 'buy') {
      current.shares += tx.shares
      current.total_invested += tx.shares * tx.price
    } else {
      // Sell: reduce shares proportionally, keep avg cost
      if (current.shares > 0) {
        const sellRatio = Math.min(tx.shares / current.shares, 1)
        current.total_invested -= current.total_invested * sellRatio
        current.shares -= tx.shares
      }
    }
    if (current.shares > 0) {
      positions.set(tx.ticker, current)
    } else {
      positions.delete(tx.ticker)
    }
  }

  return Array.from(positions.entries()).map(([ticker, p]) => ({
    ticker,
    shares: p.shares,
    avg_cost: p.shares > 0 ? p.total_invested / p.shares : 0,
    total_invested: p.total_invested,
  }))
}
