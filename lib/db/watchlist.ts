import { createClient } from '@/lib/supabase/client'

export type WatchlistItem = {
  id: string
  ticker: string
  name: string
  position: number
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('id, ticker, name, position')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addToWatchlist(
  ticker: string,
  name: string,
): Promise<void> {
  const supabase = createClient()

  const { data: maxRow } = await supabase
    .from('watchlist_items')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (maxRow?.position ?? -1) + 1

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('watchlist_items')
    .insert({ user_id: user.id, ticker, name, position: nextPosition })
  if (error) throw error
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('watchlist_items')
    .delete()
    .eq('ticker', ticker)
  if (error) throw error
}
