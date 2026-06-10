import { readFileSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';
import { createStoreFromJson, WhoAmIEngine } from '@world-cup-story-trivia/data-access';
import type { WhoAmIHint } from '@world-cup-story-trivia/shared-types';

let store: ReturnType<typeof createStoreFromJson> | null = null;

function getStore() {
  if (store) return store;
  try {
    const dataPath = join(process.cwd(), 'server-data', 'world_cup_players.json');
    const raw = readFileSync(dataPath, 'utf-8');
    store = createStoreFromJson(JSON.parse(raw));
    return store;
  } catch {
    return null;
  }
}

const SECRET = process.env.SCORE_SECRET || 'wc26-score-secret-change-in-prod';

function getDailySeed(date: string): number {
  const hmac = createHmac('sha256', SECRET).update(`daily:${date}`).digest('hex');
  return parseInt(hmac.slice(0, 8), 16);
}

export interface GameSession {
  playerId: string;
  playerName: string;
  hints: WhoAmIHint[];
  hintsRevealed: number;
  guesses: string[];
  guessesUsed: number;
  maxGuesses: number;
  status: 'playing' | 'correct' | 'wrong' | 'revealed';
  sessionType: 'daily' | 'practice';
  date?: string;
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
  const playerHash = data.playerId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);
  const sessionId = `practice-${playerHash}-${Date.now()}`;
  const session: GameSession = {
    playerId: data.playerId,
    playerName: data.playerName,
    hints: data.hints,
    hintsRevealed: 1,
    guesses: [],
    guessesUsed: 0,
    maxGuesses: 6,
    status: 'playing',
    sessionType: 'practice',
  };
  sessions.set(sessionId, session);
  return { sessionId, session };
}

export function createDailyGame(clientDate?: string): { sessionId: string; session: GameSession; date: string } | null {
  const s = getStore();
  if (!s) return null;
  const engine = new WhoAmIEngine(s);
  const date = clientDate || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const seed = getDailySeed(date);
  const data = engine.createDailyChallenge(date, seed);
  const playerHash = data.playerId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);
  const sessionId = `daily-${date}-${playerHash}`;
  const session: GameSession = {
    playerId: data.playerId,
    playerName: data.playerName,
    hints: data.hints,
    hintsRevealed: 1,
    guesses: [],
    guessesUsed: 0,
    maxGuesses: 6,
    status: 'playing',
    sessionType: 'daily',
    date,
  };
  sessions.set(sessionId, session);
  return { sessionId, session, date };
}

export function getSession(sessionId: string): GameSession | null {
  return sessions.get(sessionId) || null;
}

export function makeGuess(sessionId: string, guess: string): {
  status: string;
  answer?: string;
  score?: number;
  hintRevealed?: WhoAmIHint;
  hintsRevealed?: number;
  totalHints?: number;
  guessesUsed?: number;
  maxGuesses?: number;
} {
  const session = sessions.get(sessionId);
  if (!session) return { status: 'not_found' };
  if (session.status !== 'playing') return { status: session.status };

  session.guesses.push(guess);
  session.guessesUsed++;
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedAnswer = session.playerName.toLowerCase();

  if (normalizedGuess === normalizedAnswer) {
    session.status = 'correct';
    const score = Math.max(10, 100 - (session.guessesUsed - 1) * 18);
    return {
      status: 'correct',
      answer: session.playerName,
      score,
      guessesUsed: session.guessesUsed,
      maxGuesses: session.maxGuesses,
    };
  }

  // Wrong guess: reveal next hint
  if (session.hintsRevealed < session.hints.length) {
    session.hintsRevealed++;
    return {
      status: 'wrong',
      hintRevealed: session.hints[session.hintsRevealed - 1],
      hintsRevealed: session.hintsRevealed,
      totalHints: session.hints.length,
      guessesUsed: session.guessesUsed,
      maxGuesses: session.maxGuesses,
    };
  }

  // No more hints: game over
  session.status = 'revealed';
  return {
    status: 'revealed',
    answer: session.playerName,
    guessesUsed: session.guessesUsed,
    maxGuesses: session.maxGuesses,
  };
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
