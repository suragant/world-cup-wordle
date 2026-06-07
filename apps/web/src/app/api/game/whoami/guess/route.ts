import { NextResponse } from 'next/server';
import { makeGuess, getSession } from '../sessions';

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

  return NextResponse.json({
    ...result,
    guesses: session.guesses,
    hintsRevealed: session.hintsRevealed,
    totalHints: session.hints.length,
  });
}
