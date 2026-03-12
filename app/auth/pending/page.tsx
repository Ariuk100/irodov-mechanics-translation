"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PendingContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const name = params.get("name") ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-amber-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Хүсэлт хүлээгдэж байна</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Таны нэвтрэх хүсэлтийг хүлээн авлаа.<br />
            Админ эрх олгосны дараа та нэвтрэх боломжтой болно.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-6 space-y-4">
          {(name || email) && (
            <div className="space-y-3">
              {name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Нэр</span>
                  <span className="font-medium text-slate-900">{name}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">И-мэйл</span>
                  <span className="text-slate-900">{email}</span>
                </div>
              )}
              <div className="h-px bg-slate-100" />
            </div>
          )}

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              Таны Google бүртгэл системд бүртгэлгүй байна. Хандалт авахын тулд системийн админтай холбогдоно уу.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PendingContent />
    </Suspense>
  );
}
