"use client";

import React from "react";

import katex from "katex";
import type { BodyBlock, ProblemBlock, StatementBlock, ImageAction } from "@/types/content";

interface Props {
  body: BodyBlock[];
  /** Called when the user selects text; includes the block index it came from */
  onSelectText?: (selected: string, blockIndex: number) => void;
  /** Called when moderator clicks a formula block */
  onSelectFormula?: (latex: string, blockIndex: number) => void;
  /** Called when moderator clicks an image (or empty image placeholder) */
  onSelectImage?: (src: string | null, blockIndex: number, action: ImageAction) => void;
  /** Called when moderator clicks "insert paragraph" between blocks */
  onInsertParagraph?: (blockIndex: number) => void;
}

// Render a standalone LaTeX equation (display or inline)
function tex(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return `<code class="text-red-500 text-xs">${value}</code>`;
  }
}

// Process inline math inside arbitrary HTML strings
function processInlineMath(html: string): string {
  html = html.replace(/\\\[([\\s\S]+?)\\\]/g, (_, m) => tex(m.trim(), true));
  html = html.replace(/\\\(([\\s\S]+?)\\\)/g, (_, m) => tex(m.trim(), false));
  html = html.replace(/\$\$([\\s\S]+?)\$\$/g, (_, m) => tex(m.trim(), true));
  html = html.replace(/\$([^$\n]+?)\$/g, (_, m) => tex(m.trim(), false));
  return html;
}

function renderStatementBlocks(blocks: StatementBlock[]) {
  return (blocks ?? []).map((b, i) => {
    if (b.type === "text")
      return (
        <p
          key={i}
          className="text-slate-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processInlineMath(b.value) }}
        />
      );
    if (b.type === "equation")
      return (
        <div
          key={i}
          className="my-3 text-center overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: tex(b.value, true) }}
        />
      );
    if (b.type === "image")
      return (
        <figure key={i} className="my-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/${b.src}`} alt={b.caption ?? ""} className="mx-auto max-w-full rounded" loading="lazy" decoding="async" />
          {b.caption && <figcaption className="text-slate-400 text-sm mt-1">{b.caption}</figcaption>}
        </figure>
      );
    if (b.type === "note")
      return (
        <aside
          key={i}
          className="border-l-2 border-slate-300 pl-3 my-3 text-slate-500 text-sm italic"
          dangerouslySetInnerHTML={{ __html: processInlineMath(b.value) }}
        />
      );
    return null;
  });
}

function ProblemCard({ block, blockIndex }: { block: ProblemBlock; blockIndex: number }) {
  return (
    <details data-block-index={blockIndex} className="my-4 border border-slate-200 rounded-xl overflow-hidden group">
      <summary className="cursor-pointer px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-2 select-none">
        <span className="text-blue-600 font-mono font-semibold text-sm">{block.number}</span>
        {block.title && <span className="text-slate-600 text-sm">{block.title}</span>}
        <span className="ml-auto text-slate-400 text-xs group-open:hidden">▶ Харах</span>
        <span className="ml-auto text-slate-400 text-xs hidden group-open:inline">▼ Хураах</span>
      </summary>
      <div className="px-5 py-4 space-y-2 bg-white">
        <div className="space-y-2">{renderStatementBlocks(block.statement)}</div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 select-none">
            Бодолт
          </summary>
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
            {renderStatementBlocks(block.solution)}
          </div>
        </details>
      </div>
    </details>
  );
}

// Buttons shown between blocks in mod mode to insert content at that position
function InsertBtns({ index, onSelectImage, onInsertParagraph }: {
  index: number;
  onSelectImage?: (src: string | null, blockIndex: number, action: ImageAction) => void;
  onInsertParagraph?: (blockIndex: number) => void;
}) {
  return (
    <div className="relative flex items-center gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity group/ins py-0.5">
      <div className="flex-1 h-px bg-slate-200" />
      <div className="shrink-0 flex items-center gap-1.5">
        {onInsertParagraph && (
          <button
            type="button"
            onClick={() => onInsertParagraph(index)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 hover:border-green-400 text-slate-300 hover:text-green-600 text-[10px] font-medium transition-colors bg-white"
            title={`${index + 1}-р блокийн өмнө параграф оруулах`}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Параграф
          </button>
        )}
        {onSelectImage && (
          <button
            type="button"
            onClick={() => onSelectImage(null, index, "insert")}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 hover:border-blue-400 text-slate-300 hover:text-blue-500 text-[10px] font-medium transition-colors bg-white"
            title={`${index + 1}-р блокийн өмнө зураг оруулах`}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Зураг
          </button>
        )}
      </div>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

export default function ContentRenderer({ body, onSelectText, onSelectFormula, onSelectImage, onInsertParagraph }: Props) {
  const isMod = !!(onSelectFormula || onSelectImage || onInsertParagraph);

  return (
    <div className="space-y-1">
      {/* Insert buttons before first block */}
      {isMod && (onSelectImage || onInsertParagraph) && (
        <InsertBtns index={0} onSelectImage={onSelectImage} onInsertParagraph={onInsertParagraph} />
      )}
      {body.map((block, i) => {
        const insertBtn = (isMod && (onSelectImage || onInsertParagraph))
          ? <InsertBtns key={`ins-${i}`} index={i + 1} onSelectImage={onSelectImage} onInsertParagraph={onInsertParagraph} />
          : null;

        let blockEl: React.ReactNode = null;

        if (block.type === "text")
          blockEl = (
            <div
              data-block-index={i}
              className={`relative group my-3 rounded-lg transition-all ${
                onSelectText
                  ? "cursor-pointer hover:bg-amber-50 hover:ring-2 hover:ring-amber-200 px-2 -mx-2"
                  : ""
              }`}
              onClick={onSelectText ? () => onSelectText(block.value, i) : undefined}
              title={onSelectText ? "Орчуулах санал оруулах" : undefined}
            >
              <p
                className="text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: processInlineMath(block.value) }}
              />
              {onSelectText && (
                <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-amber-600 bg-white border border-amber-200 px-1.5 py-0.5 rounded-md pointer-events-none">
                  ✎ Засах
                </span>
              )}
            </div>
          );

        else if (block.type === "header")
          blockEl = onSelectText ? (
            <div
              data-block-index={i}
              className="relative group mt-8 mb-3 cursor-pointer"
              onClick={() => onSelectText(block.value, i)}
              title="Гарчиг засах санал оруулах"
            >
              <h2
                id={block.id}
                className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 pr-14 hover:text-blue-700 transition-colors"
              >
                {block.value}
              </h2>
              <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-amber-600 bg-white border border-amber-200 px-1.5 py-0.5 rounded-md pointer-events-none">
                ✎ Засах
              </span>
            </div>
          ) : (
            <h2
              id={block.id}
              data-block-index={i}
              className="text-xl font-semibold text-slate-900 mt-8 mb-3 border-b border-slate-200 pb-2"
            >
              {block.value}
            </h2>
          );

        else if (block.type === "equation")
          blockEl = (
            <div
              data-block-index={i}
              className={`my-4 overflow-x-auto py-2 flex items-center gap-3 justify-center relative group ${
                isMod ? "cursor-pointer rounded-xl hover:bg-violet-50 hover:ring-2 hover:ring-violet-200 transition-all" : ""
              }`}
              onClick={isMod ? () => onSelectFormula?.(block.value, i) : undefined}
              title={isMod ? "Томьёо засах санал оруулах" : undefined}
            >
              <span dangerouslySetInnerHTML={{ __html: tex(block.value, true) }} />
              {block.tag && <span className="text-slate-400 text-sm shrink-0">({block.tag})</span>}
              {isMod && (
                <span className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-violet-500 bg-white border border-violet-200 px-1.5 py-0.5 rounded-md pointer-events-none">
                  ✎ Засах
                </span>
              )}
            </div>
          );

        else if (block.type === "image") {
          const imgSrc = block.src.startsWith("http") ? block.src : `/${block.src}`;
          const isEmpty = !block.src;
          blockEl = (
            <figure data-block-index={i} className="my-6 text-center">
              {isEmpty ? (
                isMod ? (
                  <button
                    type="button"
                    onClick={() => onSelectImage?.(null, i, "insert")}
                    className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl py-10 flex flex-col items-center gap-2 text-slate-300 hover:text-blue-400 transition-colors group"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">Зураг оруулах</span>
                  </button>
                ) : (
                  <div className="w-full border border-dashed border-slate-200 rounded-xl py-10 text-slate-300 text-sm">
                    [Зураг байхгүй]
                  </div>
                )
              ) : (
                <div className={`relative block group ${isMod ? "cursor-pointer" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={block.caption ?? ""}
                    className="mx-auto max-w-full rounded shadow-sm border border-slate-100 block"
                    loading="lazy"
                    decoding="async"
                  />
                  {isMod && (
                    <div className="absolute inset-0 rounded flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <button
                        type="button"
                        onClick={() => onSelectImage?.(block.src, i, "replace")}
                        className="px-3 py-1.5 bg-white text-blue-600 text-xs font-semibold rounded-lg shadow hover:bg-blue-50 transition-colors"
                      >
                        ⟳ Солих
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectImage?.(block.src, i, "delete")}
                        className="px-3 py-1.5 bg-white text-red-600 text-xs font-semibold rounded-lg shadow hover:bg-red-50 transition-colors"
                      >
                        ✕ Устгах
                      </button>
                    </div>
                  )}
                </div>
              )}
              {block.caption && (
                <figcaption className="text-slate-400 text-sm mt-2">{block.caption}</figcaption>
              )}
            </figure>
          );
        }

        else if (block.type === "note")
          blockEl = (
            <div
              data-block-index={i}
              className={`relative group my-3 rounded-r transition-all ${
                onSelectText ? "cursor-pointer hover:ring-2 hover:ring-amber-300" : ""
              }`}
              onClick={onSelectText ? () => onSelectText(block.value, i) : undefined}
              title={onSelectText ? "Орчуулах санал оруулах" : undefined}
            >
              <aside
                className="border-l-2 border-amber-400 pl-4 py-1 text-slate-500 text-sm italic bg-amber-50 rounded-r"
                dangerouslySetInnerHTML={{ __html: processInlineMath(block.value) }}
              />
              {onSelectText && (
                <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-amber-600 bg-white border border-amber-200 px-1.5 py-0.5 rounded-md pointer-events-none">
                  ✎ Засах
                </span>
              )}
            </div>
          );

        else if (block.type === "problem")
          blockEl = <ProblemCard block={block} blockIndex={i} />;

        if (!blockEl) return null;

        return (
          <React.Fragment key={i}>
            {blockEl}
            {insertBtn}
          </React.Fragment>
        );
      })}
    </div>
  );
}
