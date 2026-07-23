/**
 * cache.ts — localStorage advisory cache with 15-minute TTL.
 *
 * Stores the last advisory results keyed by a simple query hash
 * so offline/slow scenarios can show stale-but-useful data.
 */

const CACHE_KEY = "krishi_cache";
const TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
    result: AdvisoryResult;
    savedAt: number;
}

export interface AdvisoryResult {
    advice: string;
    price: Record<string, unknown> | null;
    weather: Record<string, unknown> | null;
    sources: string[];
}

function hashQuery(query: string): string {
    // Simple deterministic hash: lower-cased, collapsed whitespace
    return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

function readStore(): Record<string, CacheEntry> {
    if (typeof window === "undefined") return {};
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function writeStore(store: Record<string, CacheEntry>): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch {
        // Storage full or unavailable — fail silently
    }
}

export function saveToCache(query: string, result: AdvisoryResult): void {
    const store = readStore();
    store[hashQuery(query)] = { result, savedAt: Date.now() };
    // Keep at most 20 entries
    const keys = Object.keys(store);
    if (keys.length > 20) {
        const oldest = keys.sort((a, b) => store[a].savedAt - store[b].savedAt)[0];
        delete store[oldest];
    }
    writeStore(store);
}

export function loadFromCache(query: string): AdvisoryResult | null {
    const store = readStore();
    const entry = store[hashQuery(query)];
    if (!entry) return null;
    if (Date.now() - entry.savedAt > TTL_MS) return null; // expired
    return entry.result;
}

export function pruneCache(): void {
    const store = readStore();
    const now = Date.now();
    for (const key of Object.keys(store)) {
        if (now - store[key].savedAt > TTL_MS) delete store[key];
    }
    writeStore(store);
}
