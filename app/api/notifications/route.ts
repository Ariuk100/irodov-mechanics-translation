import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { NotificationDoc } from "@/types/content";

// GET /api/notifications — returns latest 30 notifications for the current user
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("notifications")
    .where("recipientUid", "==", decoded.uid)
    .get();

  const notifications: NotificationDoc[] = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationDoc, "id">) }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);

  return NextResponse.json({ notifications }, {
    headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" },
  });
}

// PATCH /api/notifications — mark notifications as read
// body: { ids: string[] }  OR  { all: true }  to mark everything read
export async function PATCH(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ids, all } = body as { ids?: string[]; all?: boolean };

  let docsToMark: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (all) {
    const snap = await adminDb
      .collection("notifications")
      .where("recipientUid", "==", decoded.uid)
      .where("read", "==", false)
      .get();
    docsToMark = snap.docs;
  } else if (Array.isArray(ids) && ids.length > 0) {
    const snaps = await Promise.all(
      ids.map((id) => adminDb.collection("notifications").doc(id).get())
    );
    docsToMark = snaps
      .filter((s) => s.exists && s.data()?.recipientUid === decoded.uid)
      .map((s) => s as FirebaseFirestore.QueryDocumentSnapshot);
  }

  if (docsToMark.length > 0) {
    const batch = adminDb.batch();
    docsToMark.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }

  return NextResponse.json({ ok: true });
}
