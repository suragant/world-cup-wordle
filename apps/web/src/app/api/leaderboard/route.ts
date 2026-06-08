import { NextResponse } from 'next/server';
import { getLeaderboard } from './kv';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || undefined;
    const entries = await getLeaderboard(100, date);
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
