import { NextResponse } from 'next/server';
import { createGame, createDailyGame } from '../sessions';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'practice';
  const clientDate = body.date;

  if (mode === 'daily') {
    const result = createDailyGame(clientDate);
    if (!result) {
      return NextResponse.json({ error: 'Failed to load player data' }, { status: 500 });
    }
    const { sessionId, session, date } = result;
    return NextResponse.json({
      sessionId,
      mode: 'daily',
      date,
      playerId: session.playerId,
      hintsRevealed: session.hintsRevealed,
      hints: session.hints.slice(0, 1),
      totalHints: session.hints.length,
      status: 'playing',
      score: 100,
      guesses: [],
    });
  }

  const result = createGame();
  if (!result) {
    return NextResponse.json({ error: 'Failed to load player data' }, { status: 500 });
  }
  const { sessionId, session } = result;
  return NextResponse.json({
    sessionId,
    mode: 'practice',
    hintsRevealed: session.hintsRevealed,
    hints: session.hints.slice(0, 1),
    totalHints: session.hints.length,
    status: 'playing',
    score: 100,
    guesses: [],
  });
}
