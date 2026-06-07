import { getSupabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  name: string;
  score: number;
  hintsUsed: number;
  date: string;
}

interface LeaderboardRow {
  name: string;
  score: number;
  hints_used: number;
  date: string;
}

export async function submitScore(
  name: string,
  score: number,
  hintsUsed: number,
  date: string
): Promise<LeaderboardEntry> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const entry: LeaderboardEntry = { name: name.trim(), score, hintsUsed, date };

  const { error } = await supabase
    .from('leaderboard')
    .insert({ name: entry.name, score, hints_used: hintsUsed, date });

  if (error) throw error;
  return entry;
}

export async function getLeaderboard(limit = 20, date?: string): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('leaderboard')
    .select('name, score, hints_used, date')
    .order('score', { ascending: false })
    .order('hints_used', { ascending: true })
    .limit(limit);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return (data as LeaderboardRow[]).map(row => ({
    name: row.name,
    score: row.score,
    hintsUsed: row.hints_used,
    date: row.date,
  }));
}


