"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchSection, fetchLibrary } from "@/lib/content";
import ContentRenderer from "@/components/reader/ContentRenderer";
import Sidebar from "@/components/layout/Sidebar";
import SuggestionModal from "@/components/moderator/SuggestionModal";
import FormulaModal from "@/components/moderator/FormulaModal";
import ImageModal from "@/components/moderator/ImageModal";
import ReadingNoteModal from "@/components/moderator/ReadingNoteModal";
import type { SectionDoc, BookDoc, ImageAction } from "@/types/content";

// PDF filename map by bookId
const PDF_MAP: Record<string, string> = {
  irodov_mechanics: "mechanics.pdf",
  irodov_macrosystems: "macrosystems.pdf",
  irodov_electromagnetism: "electromagnetism.pdf",
  irodov_wave_processes: "wave.pdf",
  irodov_quantum: "quantum.pdf",
  irodov_problems: "problems.pdf",
};

export default function ReaderPage() {
  const { bookId, chapterId, sectionId } = useParams<{
    bookId: string;
    chapterId: string;
    sectionId: string;
  }>();
  const { userDoc } = useAuth();

  const [books, setBooks] = useState<BookDoc[]>([]);
  const [section, setSection] = useState<SectionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(480);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // ── Text suggestion state ──────────────────────────────────────────────────
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(-1);
  const [showTextModal, setShowTextModal] = useState(false);

  // ── Formula suggestion state ───────────────────────────────────────────────
  const [formulaModal, setFormulaModal] = useState<{ latex: string; blockIndex: number } | null>(null);

  // ── Title suggestion state ─────────────────────────────────────────────────
  const [titleModalOpen, setTitleModalOpen] = useState(false);

  // ── Reading note state ─────────────────────────────────────────────────────
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  // ── Insert paragraph state ─────────────────────────────────────────────────
  const [insertParagraphBlockIndex, setInsertParagraphBlockIndex] = useState<number | null>(null);
  const handleInsertParagraph = useCallback((blockIndex: number) => {
    setInsertParagraphBlockIndex(blockIndex);
  }, []);

  // ── Image suggestion state ─────────────────────────────────────────────────
  const [imageModal, setImageModal] = useState<{
    src: string | null;
    blockIndex: number;
    action: ImageAction;
  } | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState("");
  // ── Font size ──────────────────────────────────────────────────────────────
  type FontSize = "sm" | "base" | "lg";
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [mounted, setMounted] = useState(false);

  const isMod = userDoc?.role === "moderator" || userDoc?.role === "admin";
  const pdfFile = PDF_MAP[bookId];

  useEffect(() => {
    fetchLibrary().then(setBooks);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSection(bookId, chapterId, sectionId)
      .then((data) => {
        if (!cancelled) {
          setSection(data);
          setLoading(false);
          // Save reading position
          if (data) {
            localStorage.setItem("reader-last", JSON.stringify({ bookId, chapterId, sectionId }));
          }
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      setLoading(true);
      setSection(null);
    };
  }, [bookId, chapterId, sectionId]);

  // Read localStorage + mark mounted in ONE effect to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("reader-font-size") as FontSize | null;
    if (saved && (saved === "sm" || saved === "base" || saved === "lg")) {
      setFontSize(saved);
    }
    setMounted(true);
  }, []);

  // Save font size preference
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("reader-font-size", fontSize);
    }
  }, [fontSize, mounted]);

  // Drag-to-resize handlers
  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = pdfWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pdfWidth]);

  const onDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = dragStartX.current - e.clientX;
    const next = Math.min(900, Math.max(280, dragStartWidth.current + delta));
    setPdfWidth(next);
  }, []);

  const onDividerPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Click on a text/note block → open modal directly with the full block value
  const handleTextBlockClick = useCallback((blockValue: string, blockIndex: number) => {
    if (!isMod) return;
    setSelectedText(blockValue);
    setSelectedBlockIndex(blockIndex);
    setShowTextModal(true);
  }, [isMod]);

  const handleSelectFormula = useCallback((latex: string, blockIndex: number) => {
    setFormulaModal({ latex, blockIndex });
  }, []);

  const handleSelectImage = useCallback((src: string | null, blockIndex: number, action: ImageAction) => {
    setImageModal({ src, blockIndex, action });
  }, []);

  function showToast(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  const currentBook = books.find((b) => b.id === bookId);
  const currentChapter = currentBook?.chapters.find((c) => c.id === chapterId);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar: mobile=fixed overlay, desktop=inline */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 overflow-hidden transition-transform duration-200",
          "sm:relative sm:inset-auto sm:z-auto sm:transition-all sm:shrink-0",
          sidebarOpen
            ? "translate-x-0 sm:w-72"
            : "-translate-x-full sm:w-0 sm:translate-x-0",
        ].join(" ")}
      >
        <Sidebar books={books} />
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Sidebar нээх/хаах"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            {currentBook && (
              <>
                <span className="text-slate-400 truncate hidden sm:block max-w-[130px]">{currentBook.title}</span>
                <span className="text-slate-300 hidden sm:block">/</span>
              </>
            )}
            {currentChapter && (
              <>
                <span className="text-slate-400 truncate hidden md:block max-w-[120px]">{currentChapter.title}</span>
                <span className="text-slate-300 hidden md:block">/</span>
              </>
            )}
            <span className="font-medium text-slate-800 truncate">{section?.title ?? "..."}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0" suppressHydrationWarning>
            {/* Font size toggle */}
            <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(["sm", "base", "lg"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  title={s === "sm" ? "Жижиг" : s === "base" ? "Дунд" : "Том"}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                    mounted && fontSize === s ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"
                  }`}
                  style={{ fontSize: s === "sm" ? 11 : s === "base" ? 13 : 16 }}
                >
                  A
                </button>
              ))}
            </div>

            {pdfFile && (
              <button
                onClick={() => setPdfOpen((v) => !v)}
                title="PDF харах"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pdfOpen ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {pdfOpen ? "PDF хаах" : "PDF"}
              </button>
            )}
            {isMod && (
              <>
                {/* Reading notes bookmark */}
                <button
                  onClick={() => setNoteModalOpen(true)}
                  title="Тэмдэглэл үлдээх"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <Link
                  href="/reading-notes"
                  className="hidden sm:flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 text-slate-600 font-medium px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Тэмдэглэлүүд"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Тэмдэглэл
                </Link>
                <Link
                  href="/moderator"
                  className="text-xs bg-amber-50 border border-amber-200 text-amber-700 font-medium px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Саналууд
                </Link>
              </>
            )}
            {userDoc?.role === "admin" && (
              <Link
                href="/admin"
                className="text-xs bg-blue-50 border border-blue-200 text-blue-700 font-medium px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Админ
              </Link>
            )}
          </div>
        </header>

        {/* Content row */}
        <div className="flex-1 flex overflow-hidden">
          {/* Reader */}
          <main className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">Ачаалж байна...</p>
                </div>
              </div>
            ) : !section ? (
              <div className="flex items-center justify-center h-full text-slate-400">Хэсэг олдсонгүй</div>
            ) : (
              <div className={`max-w-3xl mx-auto px-4 sm:px-8 py-8 w-full ${mounted ? { sm: "text-sm", base: "text-base", lg: "text-lg" }[fontSize] : "text-base"}`} data-content>
                {/* Section title — clickable for mods */}
                {section.title && (
                  isMod ? (
                    <div className="relative group mb-6">
                      <h1
                        onClick={() => setTitleModalOpen(true)}
                        className="text-2xl font-bold text-slate-900 cursor-pointer hover:text-blue-700 transition-colors pr-16"
                        title="Гарчиг засах санал оруулах"
                      >
                        {section.title}
                      </h1>
                      <span className="absolute top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-amber-600 bg-white border border-amber-200 px-1.5 py-0.5 rounded-md pointer-events-none">
                        ✎ Засах
                      </span>
                    </div>
                  ) : (
                    <h1 className="text-2xl font-bold text-slate-900 mb-6">{section.title}</h1>
                  )
                )}
                <ContentRenderer
                  body={section.body}
                  onSelectText={isMod ? handleTextBlockClick : undefined}
                  onSelectFormula={isMod ? handleSelectFormula : undefined}
                  onSelectImage={isMod ? handleSelectImage : undefined}
                  onInsertParagraph={isMod ? handleInsertParagraph : undefined}
                />
                {/* Mod: buttons to insert paragraph or image at end of section */}
                {isMod && (
                  <div className="mt-8 pt-4 border-t border-dashed border-slate-300 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setInsertParagraphBlockIndex(section.body.length)}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Параграф нэмэх санал
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectImage(null, section.body.length, "insert")}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Зураг нэмэх санал
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* PDF resizable panel */}
          {pdfOpen && pdfFile && (
            <>
              <div
                onPointerDown={onDividerPointerDown}
                onPointerMove={onDividerPointerMove}
                onPointerUp={onDividerPointerUp}
                className="w-1.5 shrink-0 bg-slate-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors group flex items-center justify-center select-none"
                title="Чирж хэмжээ өөрчлөх"
              >
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-1 rounded-full bg-white" />
                  <div className="w-1 h-1 rounded-full bg-white" />
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>
              <div style={{ width: pdfWidth }} className="shrink-0 flex flex-col bg-white">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Эх ном (PDF)</span>
                  <button
                    onClick={() => setPdfOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <iframe src={`/pdfs/${pdfFile}`} className="flex-1 w-full" title="PDF viewer" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Title suggestion modal */}
      {titleModalOpen && section && (
        <SuggestionModal
          type="title"
          selectedText={section.title}
          blockIndex={-1}
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          onClose={() => setTitleModalOpen(false)}
          onSubmitted={() => { setTitleModalOpen(false); showToast("Гарчиг засах санал хадгалагдлаа!"); }}
        />
      )}

      {/* Insert paragraph modal */}
      {insertParagraphBlockIndex !== null && section && (
        <SuggestionModal
          insertMode
          selectedText=""
          blockIndex={insertParagraphBlockIndex}
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          onClose={() => setInsertParagraphBlockIndex(null)}
          onSubmitted={() => { setInsertParagraphBlockIndex(null); showToast("Шинэ параграф нэмэх санал хадгалагдлаа!"); }}
        />
      )}

      {/* Text suggestion modal */}
      {showTextModal && selectedText && (
        <SuggestionModal
          selectedText={selectedText}
          blockIndex={selectedBlockIndex}
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          onClose={() => { setShowTextModal(false); setSelectedText(null); setSelectedBlockIndex(-1); }}
          onSubmitted={() => {
            setShowTextModal(false); setSelectedText(null); setSelectedBlockIndex(-1);
            showToast("Орчуулах санал хадгалагдлаа!");
          }}
        />
      )}

      {/* Formula suggestion modal */}
      {formulaModal && (
        <FormulaModal
          latex={formulaModal.latex}
          blockIndex={formulaModal.blockIndex}
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          onClose={() => setFormulaModal(null)}
          onSubmitted={() => { setFormulaModal(null); showToast("Томьёо засах санал хадгалагдлаа!"); }}
        />
      )}

      {/* Reading note modal */}
      {noteModalOpen && (
        <ReadingNoteModal
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          bookTitle={currentBook?.title ?? ""}
          chapterTitle={currentChapter?.title ?? ""}
          sectionTitle={section?.title ?? ""}
          onClose={() => setNoteModalOpen(false)}
          onSaved={() => { setNoteModalOpen(false); showToast("Тэмдэглэл хадгалагдлаа!"); }}
        />
      )}

      {/* Image suggestion modal */}
      {imageModal && (
        <ImageModal
          blockIndex={imageModal.blockIndex}
          bookId={bookId}
          chapterId={chapterId}
          sectionId={sectionId}
          action={imageModal.action}
          currentSrc={imageModal.src ?? undefined}
          onClose={() => setImageModal(null)}
          onSubmitted={() => { setImageModal(null); showToast("Зураг засах санал хадгалагдлаа!"); }}
        />
      )}
    </div>
  );
}
