"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ReadingNote {
  id: string;
  bookId: string;
  chapterId: string;
  sectionId: string;
  comment: string;
  bookTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  createdAt: number;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("mn-MN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ReadingNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reading-notes")
      .then((r) => r.json())
      .then((d) => { setNotes(d.notes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/reading-notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setDeleting(null);
  }

  function goToSection(note: ReadingNote) {
    router.push(`/reader/${note.bookId}/${note.chapterId}/${note.sectionId}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white border border-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Миний тэмдэглэлүүд</h1>
            <p className="text-sm text-slate-400">Дутуу үлдсэн хэсгүүд</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-sm">Тэмдэглэл байхгүй байна</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => goToSection(note)}
              >
                {/* Clickable area → go to section */}
                <div className="w-full text-left px-5 pt-4 pb-3">
                  {/* Book / chapter breadcrumb */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 flex-wrap">
                    <span className="truncate max-w-[120px]">{note.bookTitle}</span>
                    {note.chapterTitle && (
                      <>
                        <span>/</span>
                        <span className="truncate max-w-[120px]">{note.chapterTitle}</span>
                      </>
                    )}
                    {note.sectionTitle && (
                      <>
                        <span>/</span>
                        <span className="font-medium text-slate-600 truncate max-w-[150px]">{note.sectionTitle}</span>
                      </>
                    )}
                  </div>

                  {/* Comment */}
                  <p className="text-sm text-slate-800 leading-relaxed">{note.comment}</p>

                  {/* Date + go hint */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{formatDate(note.createdAt)}</span>
                    <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Нэвтрэх
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <div 
                  className="px-5 pb-3 flex justify-end border-t border-slate-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deleting === note.id}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 mt-3"
                  >
                    {deleting === note.id ? "Устгаж байна..." : "Устгах"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
