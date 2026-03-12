"use client";

import { useEffect, useState } from "react";
import katex from "katex";

interface Props {
  latex: string;        // current LaTeX from DB
  blockIndex: number;
  bookId: string;
  chapterId: string;
  sectionId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function renderLatex(value: string): string {
  try {
    return katex.renderToString(value, { displayMode: true, throwOnError: false, output: "html" });
  } catch {
    return `<code class="text-red-500">${value}</code>`;
  }
}

export default function FormulaModal({
  latex,
  blockIndex,
  bookId,
  chapterId,
  sectionId,
  onClose,
  onSubmitted,
}: Props) {
  const [suggestedLatex, setSuggestedLatex] = useState(latex);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    setPreview(renderLatex(suggestedLatex));
  }, [suggestedLatex]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestedLatex.trim()) { setError("Томьёо бичнэ үү"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "formula",
          bookId, chapterId, sectionId, blockIndex,
          originalText: latex,
          suggestedText: suggestedLatex.trim(),
          note,
        }),
      });
      if (!res.ok) throw new Error("Алдаа");
      onSubmitted();
    } catch {
      setError("Санал илгээхэд алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-suggestion-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
              <span className="text-violet-600 text-xs font-mono font-bold">∑</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">Томьёо засах санал</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Two-column body */}
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {/* Left: LaTeX editor */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LaTeX засах</p>
              <textarea
                autoFocus
                rows={6}
                value={suggestedLatex}
                onChange={(e) => setSuggestedLatex(e.target.value)}
                placeholder="LaTeX томьёо..."
                className="w-full font-mono text-sm border border-slate-200 rounded-xl px-4 py-3 text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50/30 placeholder-slate-400"
              />
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Одоогийн томьёо</p>
                <div
                  className="overflow-x-auto text-center"
                  dangerouslySetInnerHTML={{ __html: renderLatex(latex) }}
                />
              </div>
            </div>

            {/* Right: live preview */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Засварлсан харагдал{" "}
                <span className="text-violet-500 normal-case font-normal">(шууд)</span>
              </p>
              <div className="border border-violet-100 bg-violet-50/40 rounded-xl px-4 py-6 min-h-[120px] flex items-center justify-center overflow-x-auto">
                {suggestedLatex.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: preview }} />
                ) : (
                  <p className="text-slate-300 text-sm">Томьёо оруулна уу...</p>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Display math ($$) горимд render хийгдэнэ. Inline томьёонд <code className="bg-slate-100 px-1 rounded">$...$</code> ашиглана уу.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 space-y-3">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Тайлбар (заавал биш) — яагаад засах санал гаргав?"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold transition-colors text-sm"
              >
                {loading ? "Хадгалж байна..." : "Санал илгээх"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
