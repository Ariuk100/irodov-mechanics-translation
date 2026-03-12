"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageAction } from "@/types/content";

interface Props {
  blockIndex: number;
  bookId: string;
  chapterId: string;
  sectionId: string;
  action: ImageAction;         // "replace" | "delete" | "insert"
  currentSrc?: string;         // existing image src (for replace/delete)
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ImageModal({
  blockIndex,
  bookId,
  chapterId,
  sectionId,
  action,
  currentSrc,
  onClose,
  onSubmitted,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const needsFile = action === "replace" || action === "insert";

  function applyFile(f: File) {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowed.includes(f.type)) { setError("Зөвшөөрөгдсөн форматгүй зураг"); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError("");
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) applyFile(f);
  }

  // Clipboard paste support
  useEffect(() => {
    if (!needsFile) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) { applyFile(f); break; }
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [needsFile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsFile && !file) { setError("Зураг сонгоно уу"); return; }
    setUploading(true); setError("");

    try {
      let tempImageUrl = "";
      let tempImagePath = "";

      if (needsFile && file) {
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await fetch("/api/suggestions/upload-image", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error ?? "Upload амжилтгүй боллоо");
        }
        const { tempImageUrl: url, tempImagePath: path } = await uploadRes.json();
        tempImageUrl = url;
        tempImagePath = path;
      }

      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          imageAction: action,
          bookId, chapterId, sectionId, blockIndex,
          originalText: currentSrc ?? "",
          suggestedText: caption,
          note,
          tempImageUrl: tempImageUrl || undefined,
          tempImagePath: tempImagePath || undefined,
        }),
      });
      if (!res.ok) throw new Error("Санал илгээхэд алдаа");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setUploading(false);
    }
  }

  const titles: Record<ImageAction, string> = {
    replace: "Зураг солих санал",
    delete: "Зураг устгах санал",
    insert: "Зураг оруулах санал",
  };

  const colors: Record<ImageAction, string> = {
    replace: "bg-blue-100 text-blue-600",
    delete: "bg-red-100 text-red-600",
    insert: "bg-green-100 text-green-600",
  };

  return (
    <div
      data-suggestion-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[action]}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900">{titles[action]}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">

            {/* Current image preview (for replace/delete) */}
            {currentSrc && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Одоогийн зураг</p>
                <div className="border border-red-100 bg-red-50 rounded-xl p-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentSrc.startsWith("http") ? currentSrc : `/${currentSrc}`} alt="" className="max-h-40 object-contain rounded" />
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {action === "delete" && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                Энэ зургийг ном дотроос устгах саналыг админд илгээнэ.
              </div>
            )}

            {/* File upload (replace / insert) */}
            {needsFile && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {action === "replace" ? "Шинэ зураг" : "Оруулах зураг"}
                </p>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) applyFile(f);
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors group ${
                    dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-400"
                  }`}
                >
                  {previewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={previewUrl} alt="" className="max-h-48 object-contain rounded" />
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-slate-400 group-hover:text-blue-500 transition-colors">Зураг сонгоно уу</p>
                      <p className="text-xs text-slate-300">PNG, JPG, WebP, SVG · 10MB хүртэл</p>
                      <p className="text-xs text-slate-300 mt-1">
                        эсвэл <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono">Ctrl+V</kbd> paste хийнэ үү
                      </p>
                    </>
                  )}
                </div>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              </div>
            )}

            {/* Caption (for insert) */}
            {action === "insert" && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Тайлбар (заавал биш)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Зургийн тайлбар..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Тайлбар (заавал биш) — яагаад энэ засварыг санал болгов?"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
                Болих
              </button>
              <button
                type="submit"
                disabled={uploading}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold transition-colors text-sm disabled:opacity-60 ${
                  action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {uploading ? "Илгээж байна..." : "Санал илгээх"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
