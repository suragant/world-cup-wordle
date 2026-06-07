export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  number: string;
  caps: string;
  goals: string;
  club: string;
  dateOfBirth: string;
  bio: string;
  photo: string;
  special: string;
}

export interface DailyChallenge {
  id: string;
  date: string;
  question: string;
  options: string[];
  answer: string;
  clue: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'who-am-i' | 'story-trivia' | 'wordle' | 'country';
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  relevance: number;
  snippets: string[];
}

export interface WhoAmIHint {
  level: number;
  text: string;
}

export interface WhoAmISession {
  playerId: string;
  playerName: string;
  hints: WhoAmIHint[];
  totalHints: number;
}

export interface WhoAmIGameState {
  sessionId: string;
  hintsRevealed: number;
  hints: WhoAmIHint[];
  answer: string;
  status: 'playing' | 'correct' | 'wrong' | 'revealed';
  score: number;
  guesses: string[];
}
