import type { Player, DailyChallenge, PlayerSearchResult, WhoAmIHint, WhoAmISession } from '@world-cup-story-trivia/shared-types';

export class WorldCupDataStore {
  private players: Player[] = [];
  private teams: Set<string> = new Set();
  private byId: Map<string, Player> = new Map();
  private byTeam: Map<string, Player[]> = new Map();
  private nameIndex: Map<string, Player[]> = new Map();

  load(players: Player[]) {
    this.players = players;
    this.teams = new Set(players.map(p => p.team));
    for (const p of players) {
      this.byId.set(p.id, p);
      const arr = this.byTeam.get(p.team) || [];
      arr.push(p);
      this.byTeam.set(p.team, arr);
      for (const t of p.name.toLowerCase().split(/[^a-z0-9]+/)) {
        if (!t) continue;
        const arr2 = this.nameIndex.get(t) || [];
        arr2.push(p);
        this.nameIndex.set(t, arr2);
      }
    }
    return this;
  }

  getAllPlayers() {
    return this.players;
  }
  getTeams() {
    return Array.from(this.teams).sort();
  }
  getPlayerById(id: string) {
    return this.byId.get(id) || null;
  }
  getPlayersByTeam(team: string) {
    return this.byTeam.get(team) || [];
  }
  search(query: string): PlayerSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const tokens = q.split(/[^a-z0-9]+/);
    const scored = new Map<string, { player: Player; score: number }>();
    for (const t of tokens) {
      if (!t) continue;
      for (const p of this.nameIndex.get(t) || []) {
        const cur = scored.get(p.id);
        const bonus = p.name.toLowerCase().startsWith(q) ? 5 : 1;
        scored.set(p.id, { player: p, score: (cur?.score || 0) + bonus });
      }
    }
    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(x => ({
        id: x.player.id,
        name: x.player.name,
        relevance: x.score,
        snippets: [x.player.team, x.player.position, x.player.club],
      }));
  }
  size() {
    return this.players.length;
  }
}

export interface DailyGameSession {
  playerId: string;
  playerName: string;
  hints: WhoAmIHint[];
  totalHints: number;
  date: string;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dateToSeed(dateStr: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) + 1;
}

export class WhoAmIEngine {
  constructor(private readonly store: WorldCupDataStore) {}

  generate(chosen?: Player, attempts = 4): DailyChallenge {
    const source = chosen ?? this.pickRandomCandidate();
    const wrong = this.pickDistractors(source, Math.max(0, attempts - 1));
    const answers = [
      { text: source.name, correct: true },
      ...wrong.map(name => ({ text: name, correct: false })),
    ];
    this.shuffle(answers);

    return {
      id: `whoami-${source.id}`,
      date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
      question: 'Who am I?',
      options: answers.map(a => a.text),
      answer: source.name,
      clue: this.buildHints(source)[0]?.text || 'I am a World Cup 2026 player.',
      difficulty: 'medium',
      category: 'who-am-i',
    };
  }

  createSession(chosen?: Player): WhoAmISession {
    const source = chosen ?? this.pickRandomCandidate();
    const hints = this.buildHints(source);
    return {
      playerId: source.id,
      playerName: source.name,
      hints,
      totalHints: hints.length,
    };
  }

  createDailyChallenge(dateStr?: string): DailyGameSession {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    const seed = dateToSeed(date);
    const rand = seededRandom(seed);
    const all = this.store.getAllPlayers();
    const idx = Math.floor(rand() * all.length);
    const source = all[idx];
    const hints = this.buildHints(source);
    return {
      playerId: source.id,
      playerName: source.name,
      hints,
      totalHints: hints.length,
      date,
    };
  }

  buildHints(source: Player): WhoAmIHint[] {
    const hints: WhoAmIHint[] = [];
    let level = 1;

    if (source.team) {
      hints.push({ level: level++, text: `I play for ${source.team}` });
    }
    if (source.position) {
      hints.push({ level: level++, text: `My position is ${source.position}` });
    }
    if (source.club) {
      hints.push({ level: level++, text: `I play for ${source.club} at club level` });
    }
    if (source.dateOfBirth) {
      const age = this.calculateAge(source.dateOfBirth);
      if (age) {
        hints.push({ level: level++, text: `I am ${age} years old` });
      }
    }
    if (source.number) {
      hints.push({ level: level++, text: `My shirt number is ${source.number}` });
    }
    if (source.special) {
      hints.push({ level: level++, text: `People say I am: "${source.special}"` });
    }

    const bioHints = this.extractBioHints(source.bio);
    for (const bh of bioHints) {
      hints.push({ level: level++, text: bh });
    }

    if (hints.length === 0) {
      hints.push({ level: level++, text: 'I am a World Cup 2026 player' });
    }

    return hints;
  }

  private extractBioHints(bio: string): string[] {
    if (!bio) return [];
    const hints: string[] = [];
    const cleaned = bio
      .replace(/\u00a0/g, ' ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const sentences = cleaned.split(/\.\s+/).filter(s => s.length > 20);
    const taken = new Set<number>();

    for (const s of sentences) {
      if (hints.length >= 3) break;
      const lower = s.toLowerCase();
      if (
        lower.includes('nickname') ||
        lower.includes('called') ||
        lower.includes('known as') ||
        lower.includes('dog') ||
        lower.includes('cat') ||
        lower.includes('pet') ||
        lower.includes('hobby') ||
        lower.includes('book') ||
        lower.includes(' favourite') ||
        lower.includes('favorite') ||
        lower.includes('family') ||
        lower.includes('father') ||
        lower.includes('mother') ||
        lower.includes('grew up') ||
        lower.includes('born') ||
        lower.includes('before football') ||
        lower.includes('other sport')
      ) {
        const idx = cleaned.indexOf(s);
        if (!taken.has(idx)) {
          taken.add(idx);
          let hint = s.trim();
          if (!hint.endsWith('.')) hint += '.';
          if (hint.length > 120) hint = hint.slice(0, 117) + '...';
          hints.push(hint);
        }
      }
    }

    if (hints.length < 2) {
      for (const s of sentences) {
        if (hints.length >= 3) break;
        const idx = cleaned.indexOf(s);
        if (!taken.has(idx) && s.length > 30 && s.length < 150) {
          taken.add(idx);
          let hint = s.trim();
          if (!hint.endsWith('.')) hint += '.';
          hints.push(hint);
        }
      }
    }

    return hints;
  }

  private calculateAge(dob: string): number | null {
    try {
      const parts = dob.split('/');
      if (parts.length !== 3) return null;
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const birth = new Date(year, month, day);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  }

  private pickRandomCandidate(): Player {
    const all = this.store.getAllPlayers();
    return all[Math.floor(Math.random() * all.length)];
  }

  private pickDistractors(source: Player, count: number): string[] {
    const all = this.store.getAllPlayers();
    const samePosition = all.filter(p => p.position === source.position && p.id !== source.id);
    const others = all.filter(p => p.id !== source.id && p.position !== source.position);
    const pool = samePosition.length >= count ? samePosition : [...samePosition, ...others];
    const shuffled = this.shuffle(pool);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(p => p.name);
  }

  private shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

export function createStoreFromJson(json: unknown): WorldCupDataStore {
  const payload = json as { players: Player[] };
  return new WorldCupDataStore().load(payload.players);
}
