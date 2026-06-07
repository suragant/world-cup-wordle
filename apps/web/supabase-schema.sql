-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC, hints_used ASC);

-- Daily scores table (to prevent multiple plays per day)
CREATE TABLE IF NOT EXISTS daily_scores (
  date TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access to leaderboard
CREATE POLICY "Allow public read" ON leaderboard
  FOR SELECT USING (true);

-- Allow public insert to leaderboard
CREATE POLICY "Allow public insert" ON leaderboard
  FOR INSERT WITH CHECK (true);

-- Allow public read access to daily_scores
CREATE POLICY "Allow public read daily" ON daily_scores
  FOR SELECT USING (true);

-- Allow public upsert to daily_scores
CREATE POLICY "Allow public upsert daily" ON daily_scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update daily" ON daily_scores
  FOR UPDATE USING (true);
