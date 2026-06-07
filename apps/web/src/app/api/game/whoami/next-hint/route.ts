import { NextResponse } from 'next/server';
import { revealNextHint, getSession } from '../sessions';

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  if (session.status !== 'playing') {
    return NextResponse.json({ error: 'Game already ended' }, { status: 400 });
  }

  const result = revealNextHint(sessionId);
  if (!result) {
    return NextResponse.json({
      error: 'No more hints available',
      hintsRevealed: session.hintsRevealed,
      totalHints: session.hints.length,
      hints: session.hints,
    }, { status: 400 });
  }

  return NextResponse.json({
    hintsRevealed: session.hintsRevealed,
    totalHints: session.hints.length,
    hints: session.hints.slice(0, session.hintsRevealed),
    status: 'playing',
    score: Math.max(10, 100 - (session.hintsRevealed - 1) * 15),
  });
}
