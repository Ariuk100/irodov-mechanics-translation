"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { NotificationDoc } from "@/types/content";

const TYPE_COLOR: Record<string, string> = {
  new_suggestion: "bg-blue-500",
  suggestion_approved: "bg-emerald-500",
  suggestion_rejected: "bg-red-500",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  new_suggestion: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  suggestion_approved: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  suggestion_rejected: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Real-time unread count via Firestore onSnapshot ──────────────────────────
  // No polling — fires only when notifications actually change.
  // Cost: initial read (N unread docs) + 1 read per new/changed notification.
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("recipientUid", "==", user.uid),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    });
    return unsub;
  }, [user]);

  // Full notification list — fetched via API only when dropdown opens
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setLoaded(true);
      }
    } catch {}
  }, []);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      if (!loaded || unreadCount > 0) await fetchNotifications();
      if (unreadCount > 0) markAllRead();
    }
  }

  function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (m < 1) return "Дөнгөж сая";
    if (m < 60) return `${m} мин өмнө`;
    if (h < 24) return `${h} цаг өмнө`;
    return `${d} өдрийн өмнө`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title="Мэдэгдлүүд"
      >
        <svg
          className="w-5 h-5 text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Мэдэгдлүүд</span>
            <button
              onClick={async () => { await fetchNotifications(); }}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              Шинэчлэх
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-400 text-sm">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Мэдэгдэл алга
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 transition-colors ${
                    !n.read ? "bg-blue-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <div
                      className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white mt-0.5 ${
                        TYPE_COLOR[n.type] ?? "bg-slate-400"
                      }`}
                    >
                      {TYPE_ICON[n.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
