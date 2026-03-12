import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// GET /api/reading-notes — list my notes (newest first)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("readingNotes")
    .where("uid", "==", decoded.uid)
    .get();

  const notes = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
  return NextResponse.json({ notes }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

// POST /api/reading-notes — create a note
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId, chapterId, sectionId, comment, bookTitle, chapterTitle, sectionTitle } =
    await req.json();

  if (!bookId || !chapterId || !sectionId || !comment?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ref = await adminDb.collection("readingNotes").add({
    uid: decoded.uid,
    bookId,
    chapterId,
    sectionId,
    comment: comment.trim(),
    bookTitle: bookTitle ?? "",
    chapterTitle: chapterTitle ?? "",
    sectionTitle: sectionTitle ?? "",
    createdAt: Date.now(),
  });

  return NextResponse.json({ id: ref.id });
}
