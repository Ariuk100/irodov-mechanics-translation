"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function createSession() {
    const user = auth.currentUser!;
    const idToken = await getIdToken(user);
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    router.push("/");
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      await createSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed")) {
        // user closed popup, ignore
      } else if (msg.startsWith("PENDING_ACCESS:")) {
        try {
          const json = JSON.parse(msg.replace("PENDING_ACCESS:", ""));
          const qs = new URLSearchParams();
          if (json.email) qs.set("email", json.email);
          if (json.displayName) qs.set("name", json.displayName);
          router.push(`/auth/pending?${qs.toString()}`);
        } catch {
          router.push("/auth/pending");
        }
      } else {
        setError("Google нэвтрэхэд алдаа гарлаа");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Физикийн номын сан</h1>
          <p className="text-slate-500 text-sm mt-1">Google бүртгэлээр нэвтрэх</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7">
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-3 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors text-sm font-medium text-slate-700 disabled:opacity-50 shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.5 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.4-11.2-8H6.3C9.7 36.7 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-2.8 5-5.1 6.6l6.2 5.2C40.7 36.5 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {googleLoading ? "Нэвтэрч байна..." : "Google-ээр нэвтрэх"}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Бүртгэлгүй бол Google-ээр нэвтэрснээр хүсэлт илгээгдэнэ
        </p>
      </div>
    </div>
  );
}
