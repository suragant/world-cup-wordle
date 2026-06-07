import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createStoreFromJson, WhoAmIEngine } from '@world-cup-story-trivia/data-access';

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

export async function GET() {
  const s = getStore();
  if (!s) {
    return NextResponse.json(
      { error: 'Failed to load player data' },
      { status: 500 },
    );
  }

  const engine = new WhoAmIEngine(s);
  const challenge = engine.generate();
  return NextResponse.json(challenge);
}
