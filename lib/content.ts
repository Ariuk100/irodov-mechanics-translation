import { db } from "./firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import type { BookDoc, SectionDoc } from "@/types/content";

// ── In-memory cache (fastest layer — page-session scope) ──────────────────────
const MEM: Map<string, { v: unknown; e: number }> = new Map();

function memGet<T>(k: string): T | undefined {
  const e = MEM.get(k);
  if (!e) return undefined;
  if (Date.now() > e.e) { MEM.delete(k); return undefined; }
  return e.v as T;
}
function memSet(k: string, v: unknown, ttl: number) {
  MEM.set(k, { v, e: Date.now() + ttl });
}

// ── Persistent localStorage TTL cache ────────────────────────────────────────
interface CacheEntry<T> { value: T; expiresAt: number; }
const PREFIX = "bk_cache:";

function getCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.value;
  } catch { return undefined; }
}

function setCache<T>(key: string, value: T, ttlMs: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs }));
  } catch {
    // localStorage may be full — silently ignore
  }
}

/** Bust a specific cached section */
export function invalidateSection(bookId: string, chapterId: string, sectionId: string) {
  const key = `section:${bookId}:${chapterId}:${sectionId}`;
  MEM.delete(key);
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PREFIX}${key}`);
}

/** Bust all library/book cache entries */
export function invalidateLibrary() {
  // Clear in-memory
  for (const k of MEM.keys()) {
    if (k.startsWith("library") || k.startsWith("book:")) MEM.delete(k);
  }
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith(PREFIX + "library") || k.startsWith(PREFIX + "book:")))
      localStorage.removeItem(k!);
  }
}


// ── TTLs ──────────────────────────────────────────────────────────────────────
// Library structure changes only when admin adds/removes books → 60 min is safe
const LIBRARY_TTL = 60 * 60 * 1000; // 60 min
// Section content changes only when a suggestion is approved → 30 min is safe
const SECTION_TTL  = 30 * 60 * 1000; // 30 min

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchLibrary(): Promise<BookDoc[]> {
  const key = "library";
  const mem = memGet<BookDoc[]>(key);
  if (mem) return mem;
  const ls = getCache<BookDoc[]>(key);
  if (ls) { memSet(key, ls, LIBRARY_TTL); return ls; }

  const snap = await getDocs(collection(db, "books"));
  const result = snap.docs.map((d) => d.data() as BookDoc);
  memSet(key, result, LIBRARY_TTL);
  setCache(key, result, LIBRARY_TTL);
  return result;
}

export async function fetchBook(bookId: string): Promise<BookDoc | null> {
  const key = `book:${bookId}`;
  const mem = memGet<BookDoc | null>(key);
  if (mem !== undefined) return mem;
  const ls = getCache<BookDoc | null>(key);
  if (ls !== undefined) { memSet(key, ls, LIBRARY_TTL); return ls; }

  const snap = await getDoc(doc(db, "books", bookId));
  const result = snap.exists() ? (snap.data() as BookDoc) : null;
  memSet(key, result, LIBRARY_TTL);
  setCache(key, result, LIBRARY_TTL);
  return result;
}

export async function fetchSection(
  bookId: string,
  chapterId: string,
  sectionId: string
): Promise<SectionDoc | null> {
  const key = `section:${bookId}:${chapterId}:${sectionId}`;

  // 1. Return from memory cache immediately (fastest path)
  const mem = memGet<SectionDoc | null>(key);
  if (mem !== undefined) {
    // Revalidate in background: only fetch if updatedAt changed
    _revalidateSection(key, bookId, chapterId, sectionId, mem);
    return mem;
  }

  // 2. Return from localStorage cache immediately
  const ls = getCache<SectionDoc | null>(key);
  if (ls !== undefined) {
    memSet(key, ls, SECTION_TTL);
    _revalidateSection(key, bookId, chapterId, sectionId, ls);
    return ls;
  }

  // 3. No cache — must fetch from Firestore
  return _fetchSectionFromFirestore(key, bookId, chapterId, sectionId);
}

/** Fetch full section from Firestore and cache it */
async function _fetchSectionFromFirestore(
  key: string,
  bookId: string,
  chapterId: string,
  sectionId: string
): Promise<SectionDoc | null> {
  const ref = doc(db, "books", bookId, "chapters", chapterId, "sections", sectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    memSet(key, null, SECTION_TTL);
    setCache(key, null, SECTION_TTL);
    return null;
  }
  const data = snap.data() as SectionDoc & { body: unknown };
  if (typeof data.body === "string") data.body = JSON.parse(data.body);
  memSet(key, data as SectionDoc, SECTION_TTL);
  setCache(key, data as SectionDoc, SECTION_TTL);
  return data as SectionDoc;
}

/**
 * Background revalidation: fetch only updatedAt from Firestore.
 * If unchanged → extend TTL silently (no re-render).
 * If changed → fetch full doc and update cache.
 * Fires-and-forgets — does not block the caller.
 */
function _revalidateSection(
  key: string,
  bookId: string,
  chapterId: string,
  sectionId: string,
  cached: SectionDoc | null
) {
  // Only revalidate if cached doc has an updatedAt to compare
  if (!cached?.updatedAt) return;
  const cachedUpdatedAt = cached.updatedAt;

  // Use setTimeout so this never blocks the render cycle
  setTimeout(async () => {
    try {
      const ref = doc(db, "books", bookId, "chapters", chapterId, "sections", sectionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const fresh = snap.data() as { updatedAt?: number };
      if ((fresh.updatedAt ?? 0) === cachedUpdatedAt) {
        // Data unchanged — just extend TTL so cache stays valid longer
        memSet(key, cached, SECTION_TTL);
        setCache(key, cached, SECTION_TTL);
      } else {
        // Data changed — fetch full doc and update cache
        const data = snap.data() as SectionDoc & { body: unknown };
        if (typeof data.body === "string") data.body = JSON.parse(data.body);
        memSet(key, data as SectionDoc, SECTION_TTL);
        setCache(key, data as SectionDoc, SECTION_TTL);
      }
    } catch { /* network error — keep stale cache */ }
  }, 1000); // slight delay to avoid competing with render
}

