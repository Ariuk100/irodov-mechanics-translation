"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import katex from "katex";
import { NotificationBell } from "@/app/components/NotificationBell";
import { wordDiff, type DiffSegment } from "@/lib/diff";
import type { UserDoc, UserRole, SuggestionDoc } from "@/types/content";
import ConfirmModal from "@/components/shared/ConfirmModal";

interface PendingRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  requestedAt: number;
}

/** Renders original text with deletions (red strikethrough) */
function DiffOld({ oldText, newText }: { oldText: string; newText: string }) {
  const segs = wordDiff(oldText, newText);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {segs.map((seg: DiffSegment, i: number) =>
        seg.op === "delete" ? (
          <mark key={i} className="bg-red-200 text-red-800 line-through rounded px-0.5">{seg.text}</mark>
        ) : seg.op === "equal" ? (
          <span key={i}>{seg.text}</span>
        ) : null
      )}
    </p>
  );
}

/** Renders suggested text with insertions (green) */
function DiffNew({ oldText, newText }: { oldText: string; newText: string }) {
  const segs = wordDiff(oldText, newText);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {segs.map((seg: DiffSegment, i: number) =>
        seg.op === "insert" ? (
          <mark key={i} className="bg-green-200 text-green-800 rounded px-0.5">{seg.text}</mark>
        ) : seg.op === "equal" ? (
          <span key={i}>{seg.text}</span>
        ) : null
      )}
    </p>
  );
}

/** KaTeX render helper */
function renderTex(value: string, displayMode: boolean): string {
  try { return katex.renderToString(value, { displayMode, throwOnError: false, strict: false, output: "html" }); }
  catch { return value; }
}

/** Process inline ($...$) and display ($$...$$) LaTeX in a plain string */
function applyLatex(text: string): string {
  text = text.replace(/\\\[([\\s\S]+?)\\\]/g, (_, m) => renderTex(m.trim(), true));
  text = text.replace(/\\\(([\\s\S]+?)\\\)/g, (_, m) => renderTex(m.trim(), false));
  text = text.replace(/\$\$([\\s\S]+?)\$\$/g, (_, m) => renderTex(m.trim(), true));
  text = text.replace(/\$([^$\n]+?)\$/g,       (_, m) => renderTex(m.trim(), false));
  return text;
}

/**
 * "Нэмэлт өөрчлөлт" — diff with LaTeX rendered.
 * equal segments → LaTeX rendered plain
 * insert segments → LaTeX rendered + green highlight wrapper
 */
function DiffNewLatex({ oldText, newText }: { oldText: string; newText: string }) {
  const segs = wordDiff(oldText, newText);
  const html = segs
    .filter((seg: DiffSegment) => seg.op !== "delete")
    .map((seg: DiffSegment) => {
      const rendered = applyLatex(seg.text);
      if (seg.op === "insert") {
        return `<mark class="bg-green-200 text-green-800 rounded px-0.5">${rendered}</mark>`;
      }
      return rendered;
    })
    .join("");
  return (
    <div
      className="text-sm leading-relaxed prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function AdminPage() {
  const { userDoc, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"users" | "suggestions">(
    searchParams.get("tab") === "suggestions" ? "suggestions" : "users"
  );

  // --- Users state ---
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // --- Pending access state ---
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  // --- Create user state ---
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // --- Suggestions state ---
  const [suggestions, setSuggestions] = useState<SuggestionDoc[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggStatus, setSuggStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [suggError, setSuggError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // --- Deletion state ---
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [suggestionToDelete, setSuggestionToDelete] = useState<string | null>(null);

  // --- Per-card error/success state ---
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [cardSuccess, setCardSuccess] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && userDoc?.role !== "admin") router.push("/");
  }, [loading, userDoc, router]);

  async function fetchUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
    setUsersLoading(false);
  }

  async function fetchPending() {
    setPendingLoading(true);
    const res = await fetch("/api/admin/pending");
    if (res.ok) {
      const data = await res.json();
      const reqs: PendingRequest[] = data.requests ?? [];
      setPendingRequests(reqs);
      const roles: Record<string, UserRole> = {};
      reqs.forEach((r) => { roles[r.uid] = "user"; });
      setPendingRoles(roles);
    }
    setPendingLoading(false);
  }

  const fetchSuggestions = useCallback(async (status: string = suggStatus) => {
    setSuggestionsLoading(true);
    const res = await fetch(`/api/suggestions?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      const suggs: SuggestionDoc[] = data.suggestions ?? [];
      setSuggestions(suggs);
      const initial: Record<string, string> = {};
      suggs.forEach((s) => { if (s.id) initial[s.id] = s.suggestedText; });
      setEditedTexts(initial);
    }
    setSuggestionsLoading(false);
  }, [suggStatus]);

  useEffect(() => {
    fetchUsers();
    fetchPending();
  }, []); // Removed fetchSuggestions from here

  // Re-fetch suggestions when tab changes to 'suggestions' to fix stale state bug
  useEffect(() => {
    if (tab === "suggestions") {
      fetchSuggestions();
    }
  }, [tab, fetchSuggestions]); // Added fetchSuggestions to dependencies

  // Handle user deletion
  function handleDeleteUser(uid: string) {
    setUserToDelete(uid);
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/admin/users?uid=${userToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.uid !== userToDelete));
      } else {
        const data = await res.json();
        alert(data.error || "Устгахад алдаа гарлаа");
      }
    } catch {
      alert("Сүлжээний алдаа");
    } finally {
      setUserToDelete(null);
    }
  }

  async function changeRole(uid: string, role: UserRole) {
    await fetch("/api/admin/setRole", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, role }),
    });
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
  }

  async function handlePending(uid: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, action, role: pendingRoles[uid] ?? "user" }),
    });
    if (res.ok) {
      setPendingRequests((prev) => prev.filter((r) => r.uid !== uid));
      if (action === "approve") fetchUsers();
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newName, role: newRole }),
      });
      if (res.ok) {
        setCreateMsg({ type: "success", text: `${newName} амжилттай бүртгэгдлээ` });
        setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("user");
        fetchUsers();
      } else {
        let errMsg = "Алдаа гарлаа";
        try { errMsg = (await res.json()).error ?? errMsg; } catch {}
        setCreateMsg({ type: "error", text: errMsg });
      }
    } finally { setCreating(false); }
  }

  async function handleSuggestion(id: string, action: "approve" | "reject") {
    setSuggError(null);
    setCardErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setProcessingId(id);
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, suggestedText: editedTexts[id] }),
      });
      if (res.ok) {
        // Brief success flash, then remove from list
        setCardSuccess((prev) => new Set(prev).add(id));
        setTimeout(() => {
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
          setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
          setCardSuccess((prev) => { const n = new Set(prev); n.delete(id); return n; });
        }, 900);
      } else {
        let msg = `Алдаа (${res.status})`;
        try { msg = (await res.json()).error ?? msg; } catch {}
        setCardErrors((prev) => ({ ...prev, [id]: msg }));
        setSuggError(msg);
      }
    } catch {
      const msg = "Сервертэй холбогдоход алдаа гарлаа";
      setCardErrors((prev) => ({ ...prev, [id]: msg }));
      setSuggError(msg);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleBulkAction(action: "approve" | "reject") {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true); setSuggError(null);
    setCardErrors({});
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/suggestions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, suggestedText: editedTexts[id] }),
        })
      )
    );

    // Separate succeeded and failed
    const succeededIds = new Set<string>();
    const newCardErrors: Record<string, string> = {};

    await Promise.all(results.map(async (r, i) => {
      const id = ids[i];
      if (r.status === "fulfilled" && r.value.ok) {
        succeededIds.add(id);
      } else {
        let msg = "Алдаа гарлаа";
        if (r.status === "fulfilled") {
          try { msg = (await r.value.json()).error ?? `Алдаа (${r.value.status})`; } catch {}
        }
        newCardErrors[id] = msg;
      }
    }));

    setCardErrors((prev) => ({ ...prev, ...newCardErrors }));
    // Only remove successfully processed suggestions
    setSuggestions((prev) => prev.filter((s) => !succeededIds.has(s.id!)));
    // Keep failed IDs still selected so admin can see/retry them
    setSelectedIds(new Set(Object.keys(newCardErrors)));
    if (Object.keys(newCardErrors).length > 0) {
      setSuggError(`${Object.keys(newCardErrors).length} санал боловсруулахад алдаа гарлаа — дэлгэрэнгүй мэдээллийг доор харна уу`);
    }
    setBulkProcessing(false);
  }

  function deleteSuggestion(id: string) {
    setSuggestionToDelete(id);
  }

  async function confirmDeleteSuggestion() {
    if (!suggestionToDelete) return;
    setSuggError(null);
    setProcessingId(suggestionToDelete);
    try {
      const res = await fetch(`/api/suggestions/${suggestionToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionToDelete));
      } else {
        let msg = `Алдаа (${res.status})`;
        try { msg = (await res.json()).error ?? msg; } catch {}
        setSuggError(msg);
      }
    } catch {
      setSuggError("Сервертэй холбогдоход алдаа гарлаа");
    } finally {
      setProcessingId(null);
      setSuggestionToDelete(null);
    }
  }

  if (loading || userDoc?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900">Админ хэрэгсэл</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Нүүр хуудас
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-8">
          {([
            { key: "users" as const, label: "Хэрэглэгчид", badge: pendingRequests.length },
            { key: "suggestions" as const, label: "Саналууд", badge: suggestions.length },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-amber-500 text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ХЭРЭГЛЭГЧИД TAB ── */}
        {tab === "users" && (
          <div className="space-y-6">

            {/* Нэвтрэх хүсэлтүүд */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Нэвтрэх хүсэлтүүд</h2>
                {pendingRequests.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
              {pendingLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex justify-center shadow-sm">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 text-sm text-slate-400">
                  Хүлээгдэж буй хүсэлт алга
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-amber-50">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Хэрэглэгч</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">И-мэйл</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Огноо</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingRequests.map((r) => (
                        <tr key={r.uid} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {r.photoURL ? (
                                <Image src={r.photoURL} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                  {(r.displayName || r.email || "?")[0].toUpperCase()}
                                </div>
                              )}
                              <p className="font-medium text-slate-900 text-sm">{r.displayName || "—"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{r.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {new Date(r.requestedAt).toLocaleDateString("mn-MN")}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={pendingRoles[r.uid] ?? "user"}
                                onChange={(e) => setPendingRoles((prev) => ({ ...prev, [r.uid]: e.target.value as UserRole }))}
                                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="user">Хэрэглэгч</option>
                                <option value="moderator">Модератор</option>
                                <option value="admin">Админ</option>
                              </select>
                              <button
                                onClick={() => handlePending(r.uid, "approve")}
                                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                              >
                                Батлах
                              </button>
                              <button
                                onClick={() => handlePending(r.uid, "reject")}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                              >
                                Татгалзах
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </section>

            {/* Хэрэглэгчдийн жагсаалт */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Бүртгэлтэй хэрэглэгчид</h2>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {usersLoading ? (
                  <div className="p-8 flex justify-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">Хэрэглэгч олдсонгүй</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Хэрэглэгч</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">И-мэйл</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Роль</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                {(u.displayName || u.email || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 text-sm">{u.displayName || "—"}</p>
                                <p className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("mn-MN")}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                          <td className="px-6 py-4 text-right">
                            {u.uid === userDoc?.uid ? (
                              <span className={`inline-block border rounded-lg px-3 py-1.5 text-xs font-medium ${
                                u.role === "admin" ? "border-blue-200 bg-blue-50 text-blue-700"
                                : u.role === "moderator" ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-white text-slate-700"
                              }`} title="Өөрийнхөө эрхийг солих боломжгүй">
                                {u.role === "admin" ? "Админ" : u.role === "moderator" ? "Модератор" : "Хэрэглэгч"}
                              </span>
                            ) : (
                              <div className="flex justify-end gap-3">
                                <select
                                  value={u.role}
                                  onChange={(e) => changeRole(u.uid, e.target.value as UserRole)}
                                  className={`border rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                                    u.role === "admin" ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : u.role === "moderator" ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-white text-slate-700"
                                  }`}
                                >
                                  <option value="user">Хэрэглэгч</option>
                                  <option value="moderator">Модератор</option>
                                  <option value="admin">Админ</option>
                                </select>
                                <button
                                  onClick={() => handleDeleteUser(u.uid)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                  title="Хэрэглэгчийг устгах"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </section>

            {/* Шинэ хэрэглэгч нэмэх */}
            <section>
              <button
                onClick={() => { setShowCreate((v) => !v); setCreateMsg(null); }}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3 hover:text-blue-600 transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showCreate ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Шинэ хэрэглэгч нэмэх
              </button>
              {showCreate && (
                <div className="max-w-md">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    {createMsg && (
                      <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm mb-5 ${createMsg.type === "success" ? "bg-green-50 border border-green-100 text-green-700" : "bg-red-50 border border-red-100 text-red-700"}`}>
                        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {createMsg.type === "success"
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                        </svg>
                        {createMsg.text}
                      </div>
                    )}
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      {[
                        { label: "Нэр", value: newName, set: setNewName, type: "text", placeholder: "Нэр овог" },
                        { label: "И-мэйл", value: newEmail, set: setNewEmail, type: "email", placeholder: "example@gmail.com" },
                        { label: "Нууц үг", value: newPassword, set: setNewPassword, type: "password", placeholder: "Хамгийн багадаа 6 тэмдэгт" },
                      ].map(({ label, value, set, type, placeholder }) => (
                        <div key={label}>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                          <input type={type} required value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Роль</label>
                        <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="user">Хэрэглэгч</option>
                          <option value="moderator">Модератор</option>
                        </select>
                      </div>
                      <button type="submit" disabled={creating}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                        {creating ? "Нэмж байна..." : "Хэрэглэгч нэмэх"}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── САНАЛУУД TAB ── */}
        {tab === "suggestions" && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {([
                { key: "pending",  label: "Хүлээгдэж буй",  color: "text-amber-700 bg-amber-50" },
                { key: "approved", label: "Батлагдсан",      color: "text-green-700 bg-green-50" },
                { key: "rejected", label: "Татгалзсан",      color: "text-red-700 bg-red-50" },
                { key: "all",      label: "Бүгд",            color: "text-slate-700 bg-white" },
              ] as const).map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSuggStatus(s.key);
                    setSelectedIds(new Set());
                    fetchSuggestions(s.key);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    suggStatus === s.key ? `shadow-sm ${s.color}` : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {suggError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <span className="flex-1">{suggError}</span>
                <button onClick={() => setSuggError(null)} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
            {suggestionsLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Санал олдсонгүй</p>
              </div>
            ) : (
              <>
                {/* Bulk action bar */}
                <div className="flex items-center justify-between gap-4 pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(suggestions.map((s) => s.id!)));
                        else setSelectedIds(new Set());
                      }}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    Бүгдийг сонгох ({selectedIds.size}/{suggestions.length})
                  </label>
                  {selectedIds.size > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBulkAction("reject")}
                        disabled={bulkProcessing}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-40"
                      >
                        {bulkProcessing ? "..." : `Татгалзах (${selectedIds.size})`}
                      </button>
                      <button
                        onClick={() => handleBulkAction("approve")}
                        disabled={bulkProcessing}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                      >
                        {bulkProcessing ? "..." : `Батлах (${selectedIds.size})`}
                      </button>
                    </div>
                  )}
                </div>

                {suggestions.map((s) => {
                  const isFormula = s.type === "formula";
                  const isImage = s.type === "image";
                  const isBlockDelete = s.type === "block_delete";
                  const latexPreview = isFormula
                    ? (() => { try { return katex.renderToString(editedTexts[s.id!] ?? s.suggestedText, { displayMode: true, throwOnError: false, strict: false, output: "html" }); } catch { return ""; } })()
                    : "";

                  return (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Card header */}
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id!)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const n = new Set(prev);
                              if (e.target.checked) n.add(s.id!); else n.delete(s.id!);
                              return n;
                            });
                          }}
                          className="w-4 h-4 rounded accent-blue-600 shrink-0"
                        />
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          isFormula ? "bg-violet-100 text-violet-700 border-violet-200"
                          : isImage ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          {isFormula ? "Томьёо" : isImage ? "Зураг" : "Текст"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono flex-1 truncate">{s.bookId} / {s.chapterId} / {s.sectionId}</span>
                        <span className="text-xs text-slate-400 shrink-0">{s.authorEmail} · {new Date(s.createdAt).toLocaleDateString("mn-MN")}</span>
                      </div>

                      {/* Card body — type-specific */}
                      {isFormula ? (
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          <div className="p-5 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Одоогийн LaTeX</p>
                            <code className="block bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 whitespace-pre-wrap break-all min-h-[80px]">
                              {s.originalText}
                            </code>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">Одоогийн preview</p>
                            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 overflow-x-auto text-center"
                              dangerouslySetInnerHTML={{ __html: (() => { try { return katex.renderToString(s.originalText, { displayMode: true, throwOnError: false, strict: false, output: "html" }); } catch { return s.originalText; } })() }}
                            />
                          </div>
                          <div className="p-5 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              Санал LaTeX <span className="text-blue-500 font-normal normal-case">(засаж болно)</span>
                            </p>
                            <textarea
                              rows={3}
                              value={editedTexts[s.id!] ?? s.suggestedText}
                              onChange={(e) => setEditedTexts((prev) => ({ ...prev, [s.id!]: e.target.value }))}
                              className="w-full font-mono border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 bg-violet-50/30"
                            />
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live preview</p>
                            <div
                              className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 overflow-x-auto text-center min-h-[60px] flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: latexPreview || "<span class='text-slate-300 text-sm'>Томьёо оруулна үү</span>" }}
                            />
                          </div>
                        </div>
                      ) : isBlockDelete ? (
                        <div className="p-5 space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                              ✕ Блок устгах санал
                            </span>
                            <span className="text-xs text-slate-400">
                              {(s as { blockType?: string }).blockType === "equation" ? "Томьёо" :
                               (s as { blockType?: string }).blockType === "header"   ? "Гарчиг" :
                               (s as { blockType?: string }).blockType === "note"     ? "Тэмдэглэл" : "Параграф"} блок
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Устгагдах агуулга</p>
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {s.originalText || <span className="italic text-slate-400">Агуулга байхгүй</span>}
                          </div>
                        </div>
                      ) : isImage ? (
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          <div className="p-5 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Одоогийн зураг</p>
                            {s.imageAction === "delete" ? (
                              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">Зургийг устгах санал</div>
                            ) : s.originalText ? (
                              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.originalText.startsWith("http") ? s.originalText : `/${s.originalText}`} alt="" className="max-h-36 object-contain rounded" />
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-400 italic">Хоосон нүдэнд зураг оруулах</div>
                            )}
                          </div>
                          <div className="p-5 space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Санал зураг</p>
                            {s.imageAction === "delete" ? (
                              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">Устгах</div>
                            ) : s.tempImageUrl ? (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.tempImageUrl} alt="" className="max-h-36 object-contain rounded" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          <div className="p-5 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Одоогийн орчуулга</p>
                            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-h-48 overflow-y-auto leading-relaxed">
                              <DiffOld oldText={s.originalText} newText={editedTexts[s.id!] ?? s.suggestedText} />
                            </div>
                          </div>
                          <div className="p-5 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              Орчуулах санал <span className="text-blue-500 font-normal">(засаж болно)</span>
                            </p>
                            <textarea
                              rows={4}
                              value={editedTexts[s.id!] ?? s.suggestedText}
                              onChange={(e) => setEditedTexts((prev) => ({ ...prev, [s.id!]: e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-green-50/50"
                            />
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Нэмэлт өөрчлөлт</p>
                            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 max-h-32 overflow-y-auto leading-relaxed">
                              <DiffNewLatex oldText={s.originalText} newText={editedTexts[s.id!] ?? s.suggestedText} />
                            </div>
                          </div>
                        </div>

                      )}

                      {/* Footer */}
                      <div className={`px-5 pb-4 space-y-2 transition-colors ${cardSuccess.has(s.id!) ? "bg-green-50/60" : ""}`}>
                        {/* Per-card error banner */}
                        {cardErrors[s.id!] && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs">
                            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <span className="flex-1 break-words">{cardErrors[s.id!]}</span>
                            <button
                              onClick={() => setCardErrors((prev) => { const n = { ...prev }; delete n[s.id!]; return n; })}
                              className="shrink-0 text-red-400 hover:text-red-600 ml-1"
                            >✕</button>
                          </div>
                        )}

                        {/* Per-card success flash */}
                        {cardSuccess.has(s.id!) && (
                          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2 text-xs">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Амжилттай хэрэглэгдлээ
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {s.note && <p className="text-sm text-slate-400 italic truncate">&ldquo;{s.note}&rdquo;</p>}
                            {/* Status badge for non-pending views */}
                            {s.status !== "pending" && !cardSuccess.has(s.id!) && (
                              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                s.status === "approved"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-red-50 text-red-600 border-red-200"
                              }`}>
                                {s.status === "approved" ? "Батлагдсан" : "Татгалзсан"}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => deleteSuggestion(s.id!)}
                              disabled={processingId === s.id || bulkProcessing || cardSuccess.has(s.id!)}
                              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Устгах"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            {s.status === "pending" && !cardSuccess.has(s.id!) && (
                              <>
                                <button
                                  onClick={() => handleSuggestion(s.id!, "reject")}
                                  disabled={processingId === s.id || bulkProcessing}
                                  className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Татгалзах
                                </button>
                                <button
                                  onClick={() => handleSuggestion(s.id!, "approve")}
                                  disabled={processingId === s.id || bulkProcessing}
                                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {processingId === s.id ? (
                                    <span className="flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                      </svg>
                                      Хадгалж байна...
                                    </span>
                                  ) : "Батлах"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
              )}
          </div>
        )}
      </div>

      {userToDelete && (
        <ConfirmModal
          title="Хэрэглэгчийг устгах"
          message="Энэ хэрэглэгчийг устгахдаа итгэлтэй байна уу? Энэ үйлдэл буцах боломжгүй бөгөөд хэрэглэгчийн эрх шууд устана."
          confirmText="Устгах"
          onConfirm={confirmDeleteUser}
          onCancel={() => setUserToDelete(null)}
        />
      )}

      {suggestionToDelete && (
        <ConfirmModal
          title="Саналыг устгах"
          message="Энэхүү орчуулах саналыг устгах уу? Энэ үйлдэл буцах боломжгүй."
          confirmText="Устгах"
          onConfirm={confirmDeleteSuggestion}
          onCancel={() => setSuggestionToDelete(null)}
        />
      )}
    </div>
  );
}
