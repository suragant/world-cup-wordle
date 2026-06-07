import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">World Cup Wordle</h1>
        <p className="mt-2 text-gray-600">Football trivia games built from the Guardian player guide.</p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/whoami"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Play Who Am I?
          </Link>
        </div>
      </div>
    </div>
  );
}
