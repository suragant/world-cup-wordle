import { NextResponse } from 'next/server';
import { getLeaderboard } from './kv';

export async function GET() {
  try {
    const entries = await getLeaderboard(20);
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
