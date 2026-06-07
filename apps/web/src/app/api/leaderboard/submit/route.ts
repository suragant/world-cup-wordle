import { NextResponse } from 'next/server';
import { submitScore } from '../kv';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, score, hintsUsed, date } = body;

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Missing name or score' }, { status: 400 });
    }

    if (score < 0 || score > 100) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const entry = await submitScore(
      name,
      score,
      hintsUsed || 0,
      date || new Date().toISOString().slice(0, 10)
    );
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
  }
}
