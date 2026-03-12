import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { notifyAllAdmins } from "@/lib/notifications";
import type { SuggestionDoc } from "@/types/content";
import type { Query, CollectionReference } from "firebase-admin/firestore";

// GET /api/suggestions — list suggestions (admin/moderator)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = callerSnap.data()?.role;
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  // Moderators only see their own suggestions; admins see all
  let query: Query | CollectionReference = adminDb.collection("suggestions");

  if (role === "moderator") {
    query = query.where("authorId", "==", decoded.uid);
  }

  if (status !== "all") {
    query = query.where("status", "==", status);
  }

  const snap = await query.get();

  const suggestions: SuggestionDoc[] = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SuggestionDoc, "id">) }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json({ suggestions }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

// POST /api/suggestions — create new suggestion (moderator/admin)
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const callerData = callerSnap.data();
  const role = callerData?.role;
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    type = "text",
    imageAction,
    bookId, chapterId, sectionId, blockIndex,
    originalText, suggestedText, note,
    tempImageUrl, tempImagePath,
  } = body;

  if (!bookId || !chapterId || !sectionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  // For text/formula we require originalText; image delete doesn't need suggestedText
  if (type !== "image" && (!originalText || !suggestedText)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const doc: SuggestionDoc = {
    type,
    bookId,
    chapterId,
    sectionId,
    blockIndex: typeof blockIndex === "number" ? blockIndex : -1,
    originalText: originalText ?? "",
    suggestedText: suggestedText ?? "",
    note: note ?? "",
    authorId: decoded.uid,
    authorEmail: callerData?.email ?? "",
    status: "pending",
    createdAt: Date.now(),
    ...(imageAction !== undefined && { imageAction }),
    ...(tempImageUrl !== undefined && { tempImageUrl }),
    ...(tempImagePath !== undefined && { tempImagePath }),
  };

  const ref = await adminDb.collection("suggestions").add(doc);

  // Notify all admins about the new suggestion (fire-and-forget)
  const authorName = callerData?.displayName || callerData?.email || "Модератор";
  const typeLabel = type === "formula" ? "томьёо" : type === "image" ? "зураг" : type === "title" ? "гарчиг" : "текст";
  notifyAllAdmins({
    type: "new_suggestion",
    title: "Шинэ орчуулгын санал",
    body: `${authorName} — ${typeLabel} засах санал илгээлээ (${sectionId})`,
    suggestionId: ref.id,
  }).catch(() => {});

  return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
}
