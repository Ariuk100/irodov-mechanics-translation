"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NotificationBell } from "@/app/components/NotificationBell";
import type { SuggestionDoc, SuggestionStatus } from "@/types/content";

const STATUS_CFG = {
  pending:  { label: "Хүлээгдэж байна", dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Батлагдсан",      dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "Татгалзагдсан",   dot: "bg-red-400",    badge: "bg-red-100 text-red-700 border-red-200" },
};

function formatId(id: string) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SuggestionCard({ s, canDelete, onDelete }: { s: SuggestionDoc; canDelete: boolean; onDelete: (id: string) => void }) {
  const cfg = STATUS_CFG[s.status];
  const date = new Date(s.createdAt).toLocaleDateString("mn-MN", {
    year: "numeric", month: "short", day: "numeric",
  });
  const sectionHref = `/reader/${s.bookId}/${s.chapterId}/${s.sectionId}`;

  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          {/* Section breadcrumb */}
          <Link
            href={sectionHref}
            className="text-xs text-slate-500 hover:text-blue-600 transition-colors truncate font-mono"
            title={`${s.bookId} / ${s.chapterId} / ${s.sectionId}`}
          >
            {formatId(s.bookId)} › {formatId(s.sectionId)}
          </Link>
          {s.blockIndex >= 0 && (
            <span className="text-xs text-slate-300 shrink-0">блок {s.blockIndex}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            (s.type ?? "text") === "formula" ? "bg-violet-100 text-violet-700 border-violet-200"
            : (s.type ?? "text") === "image" ? "bg-blue-100 text-blue-700 border-blue-200"
            : "bg-slate-100 text-slate-500 border-slate-200"
          }`}>
            {(s.type ?? "text") === "formula" ? "Томьёо" : (s.type ?? "text") === "image" ? "Зураг" : "Текст"}
          </span>
          <span className="text-xs text-slate-400">{date}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Diff body */}
      {(s.type === "image") ? (
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_40px_1fr] items-stretch">
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Одоогийн зураг</p>
            {s.imageAction === "delete" ? (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">Зургийг устгах санал</div>
            ) : s.originalText ? (
              <div className="bg-red-50 border border-red-100 rounded-xl p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.originalText.startsWith("http") ? s.originalText : `/${s.originalText}`} alt="" className="max-h-32 mx-auto object-contain rounded" />
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-400 italic">Хоосон нүдэнд зураг оруулах</div>
            )}
          </div>
          <div className="flex items-center justify-center text-slate-300 py-2 sm:py-0">
            <svg className="w-4 h-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Санал болгосон зураг</p>
            {s.imageAction === "delete" ? (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">Устгах</div>
            ) : s.tempImageUrl ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.tempImageUrl} alt="" className="max-h-32 mx-auto object-contain rounded" />
              </div>
            ) : null}
          </div>
        </div>
      ) : (s.type === "formula") ? (
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_40px_1fr] items-stretch">
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Одоогийн LaTeX</p>
            <code className="block bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono whitespace-pre-wrap break-all">{s.originalText}</code>
          </div>
          <div className="flex items-center justify-center text-slate-300 py-2 sm:py-0">
            <svg className="w-4 h-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Санал болгосон LaTeX</p>
            <code className="block bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono whitespace-pre-wrap break-all">{s.suggestedText}</code>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_40px_1fr] items-stretch">
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Одоогийн орчуулга</p>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {s.originalText}
            </div>
          </div>
          <div className="flex items-center justify-center text-slate-300 py-2 sm:py-0">
            <svg className="w-4 h-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="p-5 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Санал болгосон орчуулга</p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {s.suggestedText}
            </div>
          </div>
        </div>
      )}

      {/* Footer — note + author + delete */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {s.note && <p className="text-xs text-slate-400 italic truncate">💬 {s.note}</p>}
          {s.authorEmail && <p className="text-xs text-slate-400">{s.authorEmail}</p>}
        </div>
        {canDelete && (
          <button
            onClick={() => s.id && onDelete(s.id)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Устгах
          </button>
        )}
      </div>
    </article>
  );
}

export default function ModeratorPage() {
  const { userDoc, loading } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionDoc[]>([]);
  const [counts, setCounts] = useState<Record<SuggestionStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<SuggestionStatus>("pending");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && userDoc?.role !== "admin" && userDoc?.role !== "moderator") {
      router.push("/");
    }
  }, [loading, userDoc, router]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/suggestions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setCounts((prev) => ({ ...prev, [filter]: Math.max(0, prev[filter] - 1) }));
    }
  }

  // Fetch current tab suggestions
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/suggestions?status=${filter}`)
      .then((r) => r.ok ? r.json() : { suggestions: [] })
      .then((data) => {
        if (cancelled) return;
        const suggs: SuggestionDoc[] = data.suggestions ?? [];
        setSuggestions(suggs);
        setCounts((prev) => ({ ...prev, [filter]: suggs.length }));
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => {
      cancelled = true;
      setFetching(true);
    };
  }, [filter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-none">Орчуулах саналууд</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {userDoc?.displayName ?? userDoc?.email}
                <span className="ml-1.5 text-amber-600 font-medium">· Модератор</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Номын сан
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-8">
          {(["pending", "approved", "rejected"] as SuggestionStatus[]).map((f) => {
            const cfg = STATUS_CFG[f];
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
                {isActive && counts[f] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${cfg.badge}`}>
                    {counts[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {fetching ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Ачаалж байна...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Санал олдсонгүй</p>
            <p className="text-slate-400 text-sm mt-1">
              {filter === "pending" ? "Одоогоор хүлээгдэж буй санал байхгүй байна" :
               filter === "approved" ? "Батлагдсан санал байхгүй" : "Татгалзагдсан санал байхгүй"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                canDelete={userDoc?.role === "admin" || s.authorId === userDoc?.uid}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
