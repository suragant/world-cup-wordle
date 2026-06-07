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

interface DailyScoreRow {
  score: number;
  hints_used: number;
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

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('leaderboard')
    .select('name, score, hints_used, date')
    .order('score', { ascending: false })
    .order('hints_used', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return (data as LeaderboardRow[]).map(row => ({
    name: row.name,
    score: row.score,
    hintsUsed: row.hints_used,
    date: row.date,
  }));
}

export async function getTodayScore(date: string): Promise<{ score: number; hintsUsed: number } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('daily_scores')
    .select('score, hints_used')
    .eq('date', date)
    .single();

  if (!data) return null;
  const row = data as DailyScoreRow;
  return { score: row.score, hintsUsed: row.hints_used };
}

export async function setTodayScore(date: string, score: number, hintsUsed: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('daily_scores')
    .upsert({ date, score, hints_used: hintsUsed }, { onConflict: 'date' });
}
