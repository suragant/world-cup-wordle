'use client';

import { useEffect, useRef, useState } from 'react';

const GAME_START = new Date('2026-06-07');
const TOTAL_HINTS = 5;

function getDayIndex(): number {
  return Math.floor((Date.now() - GAME_START.getTime()) / 86400000);
}

export function generateShareText(
  dayIndex: number,
  score: number,
  hintsUsed: number,
  guessResults: string[][],
  isCorrect: boolean,
): string {
  const EMOJI: Record<string, string> = {
    correct: '\u{1F7E9}',
    wrong: '\u{2B1C}',
    unused: '\u{2B1B}',
  };
  const HINT_ICONS = '\u{1F30D} Nationality \u{00B7} \u{26BD} Club \u{00B7} \u{1F4CD} Position \u{00B7} \u{1F522} Number \u{00B7} \u{1F382} Age';
  const URL = 'https://wc26wordle.netlify.app/whoami';

  const grid = guessResults
    .map(attempt => {
      const cells = attempt.slice(0, TOTAL_HINTS).map(r => EMOJI[r] || EMOJI.wrong);
      while (cells.length < TOTAL_HINTS) cells.push(EMOJI.unused);
      return cells.join('');
    })
    .join('\n');

  return [
    `\u{1F7E9} WhoAmI #${dayIndex} — ${score}/100 (${isCorrect ? hintsUsed + ' guess' + (hintsUsed > 1 ? 'es' : '') : 'X'})`,
    grid,
    '',
    HINT_ICONS,
    URL,
  ].join('\n');
}

interface ShareModalProps {
  score: number;
  hintsUsed: number;
  guessesMax: number;
  guessResults: string[][];
  isCorrect: boolean;
  onClose: () => void;
}

export default function ShareModal({
  score,
  hintsUsed,
  guessesMax,
  guessResults,
  isCorrect,
  onClose,
}: ShareModalProps) {
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dayIndex = getDayIndex();
  const shareText = generateShareText(dayIndex, score, hintsUsed, guessResults, isCorrect);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(''), 2000);
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      showToast('Copied! \u{1F4CB}');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      showToast('Copied! \u{1F4CB}');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareToX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://wc26wordle.netlify.app/whoami');
      showToast('Link copied!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = 'https://wc26wordle.netlify.app/whoami';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Link copied!');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl">
        <div className="text-2xl font-bold text-gray-900">
          {isCorrect ? '\u{1F389} Got it!' : '\u{1F614} Better luck tomorrow'}
        </div>
        <div className="mt-1 text-sm text-gray-500">
          WhoAmI #{dayIndex} &middot; {isCorrect ? hintsUsed + ' hint' + (hintsUsed > 1 ? 's' : '') + ' used' : 'Out of guesses'}
        </div>

        <div className={`mx-auto mt-3 inline-block rounded-lg px-4 py-1.5 text-xl font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
          {score} / 100
        </div>

        <div className="mt-4 flex flex-col items-center gap-0.5 text-lg leading-relaxed tracking-wider">
          {guessResults.map((row, i) => (
            <div key={i} className="flex gap-0.5">
              {Array.from({ length: TOTAL_HINTS }, (_, j) => {
                const emoji = row[j] === 'correct' ? '\u{1F7E9}' : row[j] === 'unused' ? '\u{2B1B}' : '\u{2B1C}';
                return <span key={j}>{emoji}</span>;
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={copyResult}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied ? 'Copied \u{2713}' : '\u{1F4CB} Copy Result'}
          </button>
          <button
            onClick={shareToX}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            {'\u{1D54F} Share on X'}
          </button>
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {'\u{1F517} Copy Link'}
          </button>
        </div>

        {toast && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
