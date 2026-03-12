"use client";

import { useState, useMemo } from "react";

interface Props {
  selectedText: string;   // full raw block value (with LaTeX)
  blockIndex: number;
  bookId: string;
  chapterId: string;
  sectionId: string;
  type?: "text" | "title"; // defaults to "text"
  onClose: () => void;
  onSubmitted: () => void;
}

type DiffToken = { type: "same" | "del" | "ins"; text: string };

/** Word-level LCS diff between two strings */
function diffWords(original: string, modified: string): DiffToken[] {
  const tokenize = (s: string) => s.match(/\S+|\s+/g) ?? [];
  const a = tokenize(original);
  const b = tokenize(modified);
  const m = a.length, n = b.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  // Traceback
  const result: DiffToken[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] }); i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "del", text: a[i] }); i++;
    } else {
      result.push({ type: "ins", text: b[j] }); j++;
    }
  }
  while (i < m) result.push({ type: "del", text: a[i++] });
  while (j < n) result.push({ type: "ins", text: b[j++] });
  return result;
}

const LATEX_EXAMPLES = [
  { label: "Дотор (inline)", code: "$F = ma$" },
  { label: "Тусдаа мөр", code: "$$E = mc^2$$" },
  { label: "Векторт", code: "$\\vec{E}$" },
  { label: "Дэвшилт", code: "$x^2 + y^2$" },
  { label: "Бутархай", code: "$\\frac{a}{b}$" },
  { label: "Грек", code: "$\\alpha, \\beta, \\gamma$" },
];

export default function SuggestionModal({
  selectedText,
  blockIndex,
  bookId,
  chapterId,
  sectionId,
  type = "text",
  onClose,
  onSubmitted,
}: Props) {
  const [suggestedText, setSuggestedText] = useState(selectedText);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLatex, setShowLatex] = useState(false);

  const diff = useMemo(
    () => diffWords(selectedText, suggestedText),
    [selectedText, suggestedText]
  );

  const hasChanges = diff.some((t) => t.type !== "same");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestedText.trim()) {
      setError("Орчуулах санал бичнэ үү");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          bookId,
          chapterId,
          sectionId,
          blockIndex,
          originalText: selectedText,
          suggestedText: suggestedText.trim(),
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

  function insertLatex(code: string) {
    setSuggestedText((prev) => prev + code);
  }

  return (
    <div
      data-suggestion-modal
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {type === "title" ? "Гарчиг засах санал" : "Орчуулах санал"}
            </h2>
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
          {/* Two column body */}
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {/* Left: original with diff (deleted parts highlighted) */}
            <div className="p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Эх текст</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 h-52 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {hasChanges
                  ? diff
                      .filter((t) => t.type !== "ins")
                      .map((t, i) =>
                        t.type === "del" ? (
                          <mark
                            key={i}
                            className="bg-red-100 text-red-700 line-through rounded px-0.5"
                          >
                            {t.text}
                          </mark>
                        ) : (
                          <span key={i}>{t.text}</span>
                        )
                      )
                  : selectedText}
              </div>
            </div>

            {/* Right: textarea + diff preview */}
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Засварласан текст</p>
                <button
                  type="button"
                  onClick={() => setShowLatex((v) => !v)}
                  className={`text-xs px-2 py-0.5 rounded-md font-mono font-medium transition-colors ${
                    showLatex
                      ? "bg-violet-100 text-violet-700"
                      : "bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600"
                  }`}
                >
                  LaTeX
                </button>
              </div>

              {/* LaTeX helper chips */}
              {showLatex && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-violet-600 font-medium">Товчлуур дарж оруулна уу:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LATEX_EXAMPLES.map((ex) => (
                      <button
                        key={ex.code}
                        type="button"
                        onClick={() => insertLatex(ex.code)}
                        title={ex.label}
                        className="px-2 py-1 bg-white border border-violet-200 rounded-lg text-xs font-mono text-violet-800 hover:bg-violet-100 transition-colors"
                      >
                        {ex.code}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Дотор томьёо: <code className="bg-white px-1 rounded">$...$</code> · Тусдаа мөр:{" "}
                    <code className="bg-white px-1 rounded">$$...$$</code>
                  </p>
                </div>
              )}

              <textarea
                autoFocus
                required
                rows={8}
                value={suggestedText}
                onChange={(e) => setSuggestedText(e.target.value)}
                placeholder="Засварласан текстийг энд бичнэ үү..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 h-52"
              />

              {/* Diff preview: new text with insertions highlighted */}
              {hasChanges && (
                <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-3 text-sm text-slate-800 max-h-[120px] overflow-y-auto leading-relaxed whitespace-pre-wrap">
                  {diff
                    .filter((t) => t.type !== "del")
                    .map((t, i) =>
                      t.type === "ins" ? (
                        <mark
                          key={i}
                          className="bg-green-200 text-green-800 rounded px-0.5"
                        >
                          {t.text}
                        </mark>
                      ) : (
                        <span key={i}>{t.text}</span>
                      )
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Note + error + actions */}
          <div className="px-5 pb-5 space-y-3">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Тайлбар (заавал биш) — яагаад засах санал гаргав?"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
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
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors text-sm"
              >
                {loading ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
