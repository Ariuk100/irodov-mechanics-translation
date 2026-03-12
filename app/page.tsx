"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchLibrary } from "@/lib/content";
import { NotificationBell } from "@/app/components/NotificationBell";
import type { BookDoc } from "@/types/content";

const BOOK_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

interface LastRead { bookId: string; chapterId: string; sectionId: string; }

export default function HomePage() {
  const { user, userDoc, loading, signOut } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<BookDoc[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("reader-last");
      if (saved) setLastRead(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchLibrary()
        .then(setBooks)
        .finally(() => setBooksLoading(false));
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-lg">Физикийн номын сан</span>
          </div>

          <div className="flex items-center gap-4">
            {userDoc?.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Админ
              </Link>
            )}
            {(userDoc?.role === "moderator" || userDoc?.role === "admin") && (
              <Link
                href={userDoc?.role === "admin" ? "/admin?tab=suggestions" : "/moderator"}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-600 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Саналууд
              </Link>
            )}

            {(userDoc?.role === "admin" || userDoc?.role === "moderator") && (
              <NotificationBell />
            )}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                {(userDoc?.displayName ?? user.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900 leading-none">{userDoc?.displayName ?? user.email}</p>
                {userDoc?.role === "admin" && (
                  <p className="text-xs text-blue-600 mt-0.5">Админ</p>
                )}
                {userDoc?.role === "moderator" && (
                  <p className="text-xs text-amber-600 mt-0.5">Модератор</p>
                )}
              </div>
            </div>

            <button
              onClick={async () => {
                await signOut();
                await fetch("/api/auth/session", { method: "DELETE" });
                router.push("/auth/login");
              }}
              className="text-sm text-slate-400 hover:text-red-500 transition-colors"
              title="Гарах"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Continue reading banner */}
        {lastRead && (
          <div className="mb-6 flex items-center justify-between gap-4 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-blue-500 font-medium">Үргэлжлүүлэх</p>
                <p className="text-sm font-semibold text-blue-900 truncate">
                  {lastRead.bookId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} › {lastRead.sectionId.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <Link
              href={`/reader/${lastRead.bookId}/${lastRead.chapterId}/${lastRead.sectionId}`}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Үргэлжлүүлэх
            </Link>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Номын сан</h2>
          <p className="text-slate-500 mt-1 text-sm">Иродовын физикийн ном — монгол орчуулга</p>
        </div>

        {booksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-40 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p>Ном олдсонгүй</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {books.map((book, idx) => {
              const firstChapter = book.chapters[0];
              const firstSection = firstChapter?.sections[0];
              const href = firstSection
                ? `/reader/${book.id}/${firstChapter.id}/${firstSection.id}`
                : "#";
              const totalSections = book.chapters.reduce((acc, ch) => acc + ch.sections.length, 0);
              const gradient = BOOK_COLORS[idx % BOOK_COLORS.length];
              return (
                <Link
                  key={book.id}
                  href={href}
                  className="group block bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-200"
                >
                  <div className={`h-2 bg-gradient-to-r ${gradient}`} />
                  <div className="p-6">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug mb-3">
                      {book.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {book.chapters.length} бүлэг
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {totalSections} хэсэг
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
