import { NextResponse } from 'next/server';
import { searchPlayers } from '../sessions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const results = searchPlayers(q);
  return NextResponse.json(results);
}
