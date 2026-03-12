"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BookDoc } from "@/types/content";

interface Props {
  books: BookDoc[];
}

export default function Sidebar({ books }: Props) {
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const pathname = usePathname();

  // Auto-open current book/chapter
  const pathParts = pathname.split("/");
  const currentBookId = pathParts[2];
  const currentChapterId = pathParts[3];

  return (
    <nav className="flex flex-col h-full bg-white">
      {/* Back link */}
      <div className="px-4 py-4 border-b border-slate-100 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Номын сан
        </Link>
      </div>

      {/* Book tree */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {books.map((book) => {
          const isBookOpen = openBook === book.id || currentBookId === book.id;
          return (
            <div key={book.id} className="mb-1">
              <button
                onClick={() => setOpenBook(isBookOpen ? null : book.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between gap-2 ${
                  currentBookId === book.id
                    ? "text-blue-700 bg-blue-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="truncate leading-snug">{book.title}</span>
                <svg
                  className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isBookOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isBookOpen && (
                <div className="mt-1 ml-2 space-y-0.5">
                  {book.chapters.map((ch) => {
                    const isChOpen = openChapter === ch.id || currentChapterId === ch.id;
                    return (
                      <div key={ch.id}>
                        <button
                          onClick={() => setOpenChapter(isChOpen ? null : ch.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                            currentChapterId === ch.id
                              ? "text-blue-600 bg-blue-50/70"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          }`}
                        >
                          <span className="truncate">{ch.title}</span>
                          <svg
                            className={`w-3 h-3 shrink-0 text-slate-400 transition-transform duration-200 ${isChOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isChOpen && (
                          <div className="mt-0.5 ml-3 space-y-0.5 pb-1">
                            {ch.sections.map((sec) => {
                              const href = `/reader/${book.id}/${ch.id}/${sec.id}`;
                              const active = pathname === href;
                              return (
                                <Link
                                  key={sec.id}
                                  href={href}
                                  className={`block px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
                                    active
                                      ? "bg-blue-600 text-white font-medium"
                                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  }`}
                                >
                                  {sec.title}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
