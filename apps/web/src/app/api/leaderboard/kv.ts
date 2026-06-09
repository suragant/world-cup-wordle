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

  if (date) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('name, score, hints_used, date')
      .eq('date', date)
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

  const { data, error } = await supabase
    .from('leaderboard')
    .select('name, score, hints_used, date')
    .order('score', { ascending: false });

  if (error || !data) return [];

  const totalByPlayer = new Map<string, { name: string; totalScore: number; gamesPlayed: number; bestScore: number; lastDate: string }>();
  for (const row of data as LeaderboardRow[]) {
    const existing = totalByPlayer.get(row.name);
    if (existing) {
      existing.totalScore += row.score;
      existing.gamesPlayed++;
      if (row.score > existing.bestScore) existing.bestScore = row.score;
      if (row.date > existing.lastDate) existing.lastDate = row.date;
    } else {
      totalByPlayer.set(row.name, {
        name: row.name,
        totalScore: row.score,
        gamesPlayed: 1,
        bestScore: row.score,
        lastDate: row.date,
      });
    }
  }

  return Array.from(totalByPlayer.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map(p => ({
      name: p.name,
      score: p.totalScore,
      hintsUsed: p.gamesPlayed,
      date: p.lastDate,
    }));
}


