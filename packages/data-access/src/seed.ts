import { readFileSync } from 'fs';
import { WorldCupDataStore } from './store';

export function seed() {
  const raw = readFileSync(new URL('../../../world_cup_players.json', import.meta.url), 'utf-8');
  const parsed = JSON.parse(raw);
  return new WorldCupDataStore().load(parsed.players);
}
