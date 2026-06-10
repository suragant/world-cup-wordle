'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ShareModal from './share-modal';

interface Hint {
  level: number;
  text: string;
}

interface GameState {
  sessionId: string;
  hintsRevealed: number;
  hints: Hint[];
  totalHints: number;
  status: 'idle' | 'playing' | 'correct' | 'wrong' | 'revealed';
  score: number;
  guesses: string[];
  guessesUsed: number;
  maxGuesses: number;
  answer?: string;
  mode: 'daily' | 'practice';
  date?: string;
  signature?: string;
}

interface SearchResult {
  id: string;
  name: string;
  team: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  hintsUsed: number;
  date: string;
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hasPlayedToday(): boolean {
  if (typeof window === 'undefined') return false;
  const key = `whoami-played-${getTodayKey()}`;
  return localStorage.getItem(key) === 'true';
}

function markPlayedToday() {
  const key = `whoami-played-${getTodayKey()}`;
  localStorage.setItem(key, 'true');
}

function getTodayResult(): { score: number; hintsUsed: number; guessResults: string[][] } | null {
  if (typeof window === 'undefined') return null;
  const key = `whoami-result-${getTodayKey()}`;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveTodayResult(score: number, hintsUsed: number, guessResults: string[][]) {
  const key = `whoami-result-${getTodayKey()}`;
  localStorage.setItem(key, JSON.stringify({ score, hintsUsed, guessResults }));
}

function getSavedName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('whoami-player-name') || '';
}

function setSavedName(name: string) {
  localStorage.setItem('whoami-player-name', name);
}

export default function WhoAmIPage() {
  const [game, setGame] = useState<GameState | null>(null);
  const [guess, setGuess] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'daily' | 'alltime'>('daily');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const [guessResults, setGuessResults] = useState<string[][]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const playedToday = hasPlayedToday();
  const todayResult = getTodayResult();
  const savedName = getSavedName();

  const fetchLeaderboard = useCallback(async (tab: 'daily' | 'alltime' = leaderboardTab) => {
    try {
      const url = tab === 'daily'
        ? `/api/leaderboard?date=${getTodayKey()}`
        : '/api/leaderboard';
      const res = await fetch(url);
      const data = await res.json();
      setLeaderboard(data);
    } catch {}
  }, [leaderboardTab]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const startGame = useCallback(async (gameMode: 'daily' | 'practice') => {
    setLoading(true);
    setError('');
    setMode(gameMode);
    try {
      const res = await fetch('/api/game/whoami/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: gameMode, date: gameMode === 'daily' ? getTodayKey() : undefined }),
      });
      if (!res.ok) throw new Error('Failed to start game');
      const data = await res.json();
      setGame({
        ...data,
        status: 'playing',
      });
      setGuess('');
      setSearchResults([]);
    } catch {
      setError('Failed to load game. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGuess = async (guessValue: string) => {
    if (!game || !guessValue.trim() || game.status !== 'playing') return;
    setLoading(true);
    setError('');
    const hintsAtGuess = game.hintsRevealed;
    try {
      const res = await fetch('/api/game/whoami/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: game.sessionId, guess: guessValue.trim() }),
      });
      const data = await res.json();

      if (data.status === 'correct') {
        const allCorrect = ['correct', 'correct', 'correct', 'correct', 'correct'];
        const finalResults = [...guessResults, allCorrect];
        setGuessResults(finalResults);
        setGame(prev => prev ? {
          ...prev,
          status: 'correct',
          guesses: data.guesses,
          guessesUsed: data.guessesUsed,
          score: data.score,
          answer: data.answer,
          signature: data.signature,
        } : null);
        if (game.mode === 'daily') {
          markPlayedToday();
          saveTodayResult(data.score, data.guessesUsed, finalResults);
          setTimeout(() => setShowShareModal(true), 1000);
          if (savedName) {
            // Auto-submit with saved name
            setPlayerName(savedName);
            setTimeout(() => submitScoreWith(savedName, data.score, data.guessesUsed, game.date || getTodayKey()), 0);
          } else {
            setShowNameInput(true);
          }
        }
      } else if (data.status === 'wrong') {
        // Wrong guess: auto-reveal next hint
        setGuessResults(prev => {
          const revealed = Math.min(data.hintsRevealed, 5);
          const row = Array.from({ length: 5 }, (_, i) => i < revealed ? 'wrong' : 'unused');
          return [...prev, row];
        });
        setGame(prev => prev ? {
          ...prev,
          guesses: data.guesses,
          guessesUsed: data.guessesUsed,
          hintsRevealed: data.hintsRevealed,
          totalHints: data.totalHints,
          hints: prev.hints.length < data.hintsRevealed
            ? [...prev.hints, data.hintRevealed]
            : prev.hints,
        } : null);
      } else if (data.status === 'revealed') {
        // Game over: no more guesses
        const revealedHints = Math.min(hintsAtGuess, 5);
        const lastRow = Array.from({ length: 5 }, (_, i) => i < revealedHints ? 'wrong' : 'unused');
        const finalResults = [...guessResults, lastRow];
        setGuessResults(finalResults);
        setGame(prev => prev ? {
          ...prev,
          status: 'revealed',
          guesses: data.guesses,
          guessesUsed: data.guessesUsed,
          answer: data.answer,
        } : null);
        if (game.mode === 'daily') {
          markPlayedToday();
          saveTodayResult(0, data.guessesUsed, finalResults);
          setShowShareModal(true);
        }
      }

      setGuess('');
      setShowDropdown(false);
    } catch {
      setError('Failed to submit guess. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitScore = async () => {
    if (!playerName.trim() || !game) return;
    setLoading(true);
    try {
      setSavedName(playerName.trim());
      await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName.trim(),
          score: game.score,
          hintsUsed: game.guessesUsed,
          date: game.date || getTodayKey(),
          signature: game.signature,
          sessionId: game.sessionId,
        }),
      });
      setShowNameInput(false);
      setShowLeaderboard(true);
      fetchLeaderboard();
    } catch {
      setError('Failed to submit score.');
    } finally {
      setLoading(false);
    }
  };

  const submitScoreWith = async (name: string, score: number, hintsUsed: number, date: string) => {
    try {
      setSavedName(name);
      await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, hintsUsed, date, signature: game?.signature, sessionId: game?.sessionId }),
      });
      setShowLeaderboard(true);
      fetchLeaderboard();
    } catch {}
  };

  const selectPlayer = (name: string) => {
    setGuess(name);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (guess.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/game/whoami/search?q=${encodeURIComponent(guess)}`);
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [guess]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (showLeaderboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-8">
        <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 text-center">Leaderboard</h2>

          <div className="mt-4 flex rounded-lg border border-gray-200 bg-gray-100 p-1">
            <button
              onClick={() => { setLeaderboardTab('daily'); fetchLeaderboard('daily'); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                leaderboardTab === 'daily'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => { setLeaderboardTab('alltime'); fetchLeaderboard('alltime'); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                leaderboardTab === 'alltime'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Time
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-400 mt-6">
              {leaderboardTab === 'daily' ? 'No scores today yet. Be the first!' : 'No scores yet. Be the first!'}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
                    i === 0 ? 'bg-yellow-50 border border-yellow-200' :
                    i === 1 ? 'bg-gray-50 border border-gray-200' :
                    i === 2 ? 'bg-orange-50 border border-orange-200' :
                    'bg-white border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-200 text-yellow-800' :
                      i === 1 ? 'bg-gray-200 text-gray-700' :
                      i === 2 ? 'bg-orange-200 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{entry.name}</p>
                      <p className="text-xs text-gray-500">
                        {leaderboardTab === 'alltime'
                          ? `${entry.hintsUsed} game${entry.hintsUsed > 1 ? 's' : ''}`
                          : `${entry.hintsUsed} hint${entry.hintsUsed > 1 ? 's' : ''} used`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{entry.score}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                setShowLeaderboard(false);
                if (playedToday && mode === 'daily') {
                  setMode('practice');
                }
              }}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {playedToday && mode === 'daily' ? 'Play Practice Mode' : 'Back to Game'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-8">
        <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 text-center">Who Am I?</h1>
          <p className="text-sm text-gray-600 text-center mt-2">
            Guess the player from progressive hints
          </p>

          {playedToday && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm font-medium text-amber-800">You already played today!</p>
              {todayResult && (
                <>
                  <p className="text-xs text-amber-600 mt-1">
                    Today&apos;s score: {todayResult.score} points ({todayResult.hintsUsed} hint{todayResult.hintsUsed > 1 ? 's' : ''})
                  </p>
                  {todayResult.guessResults && todayResult.guessResults.length > 0 && (
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="mt-2 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      Share Result
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!playedToday && (
              <button
                onClick={() => startGame('daily')}
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Daily Challenge'}
              </button>
            )}
            <button
              onClick={() => startGame('practice')}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Practice Mode'}
            </button>
            <button
              onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isGameOver = game.status === 'correct' || game.status === 'revealed';
  const guessesLeft = game.maxGuesses - game.guessesUsed;
  const progress = (game.guessesUsed / game.maxGuesses) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {game.mode === 'daily' ? 'Daily Challenge' : 'Practice Mode'}
              </span>
              {game.date && <span className="text-gray-400">{game.date}</span>}
            </div>
            <span className={`font-medium ${guessesLeft <= 2 ? 'text-red-500' : ''}`}>
              {guessesLeft} guess{guessesLeft !== 1 ? 'es' : ''} left
            </span>
          </div>

          <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                guessesLeft <= 2 ? 'bg-red-400' : 'bg-indigo-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-6 space-y-3">
            {game.hints.map((hint) => (
              <div
                key={hint.level}
                className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
              >
                <span className="mr-2 inline-block rounded-full bg-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700">
                  {hint.level}
                </span>
                {hint.text}
              </div>
            ))}
          </div>

          {game.guesses.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs text-gray-500">Your guesses:</p>
              <div className="flex flex-wrap gap-2">
                {game.guesses.map((g, i) => (
                  <span key={i} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!isGameOver && (
            <div className="mt-6 space-y-3">
              <div className="relative" ref={dropdownRef}>
                <input
                  ref={inputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && guess.trim()) {
                      handleGuess(guess);
                    }
                  }}
                  placeholder="Type a player name..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => selectPlayer(r.name)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-indigo-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="text-xs text-gray-500">{r.team}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleGuess(guess)}
                disabled={loading || !guess.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Guess'}
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="mt-6">
              <div className={`rounded-lg p-4 text-center ${game.status === 'correct' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                {game.status === 'correct' ? (
                  <>
                    <p className="text-lg font-bold">Correct!</p>
                    <p className="mt-1 text-sm">The answer is <strong>{game.answer}</strong></p>
                    <p className="mt-2 text-2xl font-bold">{game.score} points</p>
                    <p className="text-xs text-emerald-600">
                      Guessed in {game.guessesUsed} attempt{game.guessesUsed > 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold">Game Over</p>
                    <p className="mt-1 text-sm">The answer was <strong>{game.answer}</strong></p>
                    <p className="mt-2 text-xs text-amber-600">No more guesses left!</p>
                  </>
                )}
              </div>

              {showNameInput && game.mode === 'daily' ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-center text-gray-600">Enter your name for the leaderboard:</p>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && playerName.trim()) {
                        submitScore();
                      }
                    }}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={submitScore}
                    disabled={!playerName.trim() || loading}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Score'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => startGame(mode)}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Share Result
                  </button>
                  <button
                    onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Leaderboard
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          {game.mode === 'daily'
            ? 'Daily challenge - one attempt per day'
            : 'Wrong guess reveals the next hint. 6 guesses total.'}
        </p>
      </div>

      {showShareModal && (() => {
        const stored = todayResult?.guessResults?.length ? todayResult : null;
        const shareScore = game?.status !== 'idle' && game ? game.score : (stored?.score || 0);
        const shareHints = game?.status !== 'idle' && game ? game.guessesUsed : (stored?.hintsUsed || 0);
        const shareResults = guessResults.length > 0 ? guessResults : (stored?.guessResults || []);
        return (
          <ShareModal
            score={shareScore}
            hintsUsed={shareHints}
            guessesMax={game?.maxGuesses || 6}
            guessResults={shareResults}
            isCorrect={game?.status === 'correct'}
            onClose={() => setShowShareModal(false)}
          />
        );
      })()}
    </div>
  );
}
