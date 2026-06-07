import { NextResponse } from 'next/server';
import { submitScore } from '../kv';
import { createHmac } from 'crypto';

const SECRET = process.env.SCORE_SECRET || 'wc26-score-secret-change-in-prod';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, score, hintsUsed, date, signature, sessionId } = body;

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Missing name or score' }, { status: 400 });
    }

    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 20) {
      return NextResponse.json({ error: 'Name must be 1-20 characters' }, { status: 400 });
    }

    if (score < 0 || score > 100) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    // Verify signature: only server can generate valid signatures
    if (signature && sessionId) {
      const payload = `${sessionId}:${score}:${hintsUsed || 0}:${date || new Date().toISOString().slice(0, 10)}`;
      const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
      if (signature !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
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
