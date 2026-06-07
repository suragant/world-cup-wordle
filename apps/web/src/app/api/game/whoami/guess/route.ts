import { NextResponse } from 'next/server';
import { makeGuess, getSession } from '../sessions';
import { createHmac } from 'crypto';

const SECRET = process.env.SCORE_SECRET || 'wc26-score-secret-change-in-prod';

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, guess } = body;

  if (!sessionId || !guess) {
    return NextResponse.json({ error: 'Missing sessionId or guess' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  const result = makeGuess(sessionId, guess);

  // Sign the result so submit endpoint can verify (no client can forge)
  const payload = result.status === 'correct'
    ? `${sessionId}:${result.score}:${session.guessesUsed}:${session.date || 'practice'}`
    : '';
  const signature = payload ? createHmac('sha256', SECRET).update(payload).digest('hex') : '';

  return NextResponse.json({
    ...result,
    guesses: session.guesses,
    signature,
  });
}
