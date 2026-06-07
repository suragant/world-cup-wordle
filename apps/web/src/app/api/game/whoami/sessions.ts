import { readFileSync } from 'fs';
import { join } from 'path';
import { createStoreFromJson, WhoAmIEngine } from '@world-cup-story-trivia/data-access';
import type { WhoAmIHint } from '@world-cup-story-trivia/shared-types';

let store: ReturnType<typeof createStoreFromJson> | null = null;

function getStore() {
  if (store) return store;
  try {
    const dataPath = join(process.cwd(), 'public', 'world_cup_players.json');
    const raw = readFileSync(dataPath, 'utf-8');
    store = createStoreFromJson(JSON.parse(raw));
    return store;
  } catch {
    return null;
  }
}

export interface GameSession {
  playerId: string;
  playerName: string;
  hints: WhoAmIHint[];
  hintsRevealed: number;
  guesses: string[];
  status: 'playing' | 'correct' | 'wrong' | 'revealed';
}

declare global {
  var __whoamiSessions: Map<string, GameSession> | undefined;
}

const sessions: Map<string, GameSession> = global.__whoamiSessions || (global.__whoamiSessions = new Map());

export function createGame(): { sessionId: string; session: GameSession } | null {
  const s = getStore();
  if (!s) return null;
  const engine = new WhoAmIEngine(s);
  const data = engine.createSession();
  const sessionId = `${data.playerId}-${Date.now()}`;
  const session: GameSession = {
    playerId: data.playerId,
    playerName: data.playerName,
    hints: data.hints,
    hintsRevealed: 1,
    guesses: [],
    status: 'playing',
  };
  sessions.set(sessionId, session);
  return { sessionId, session };
}

export function createDailyGame(): { sessionId: string; session: GameSession; date: string } | null {
  const s = getStore();
  if (!s) return null;
  const engine = new WhoAmIEngine(s);
  const date = new Date().toISOString().slice(0, 10);
  const data = engine.createDailyChallenge(date);
  const sessionId = `daily-${date}-${data.playerId}`;
  const session: GameSession = {
    playerId: data.playerId,
    playerName: data.playerName,
    hints: data.hints,
    hintsRevealed: 1,
    guesses: [],
    status: 'playing',
  };
  sessions.set(sessionId, session);
  return { sessionId, session, date };
}

export function getSession(sessionId: string): GameSession | null {
  return sessions.get(sessionId) || null;
}

export function revealNextHint(sessionId: string): { hint: WhoAmIHint; hintsRevealed: number; totalHints: number } | null {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'playing') return null;
  if (session.hintsRevealed >= session.hints.length) return null;
  session.hintsRevealed++;
  return {
    hint: session.hints[session.hintsRevealed - 1],
    hintsRevealed: session.hintsRevealed,
    totalHints: session.hints.length,
  };
}

export function makeGuess(sessionId: string, guess: string): { status: string; answer?: string; score?: number } {
  const session = sessions.get(sessionId);
  if (!session) return { status: 'not_found' };
  if (session.status !== 'playing') return { status: session.status };

  session.guesses.push(guess);
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedAnswer = session.playerName.toLowerCase();

  if (normalizedGuess === normalizedAnswer) {
    session.status = 'correct';
    const score = Math.max(10, 100 - (session.hintsRevealed - 1) * 15);
    return { status: 'correct', answer: session.playerName, score };
  }

  return { status: 'wrong' };
}

export function searchPlayers(query: string): { id: string; name: string; team: string }[] {
  const s = getStore();
  if (!s) return [];
  const results = s.search(query);
  return results.map(r => {
    const player = s.getPlayerById(r.id);
    return {
      id: r.id,
      name: r.name,
      team: player?.team || '',
    };
  });
}
