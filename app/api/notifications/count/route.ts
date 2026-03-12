import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const CC = "private, max-age=30, stale-while-revalidate=60";

// GET /api/notifications/count — cheap unread count (1 Firestore aggregation query)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ unread: 0 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ unread: 0 });

  try {
    const snap = await adminDb
      .collection("notifications")
      .where("recipientUid", "==", decoded.uid)
      .where("read", "==", false)
      .count()
      .get();
    return NextResponse.json({ unread: snap.data().count }, { headers: { "Cache-Control": CC } });
  } catch {
    const snap = await adminDb
      .collection("notifications")
      .where("recipientUid", "==", decoded.uid)
      .where("read", "==", false)
      .get();
    return NextResponse.json({ unread: snap.size }, { headers: { "Cache-Control": CC } });
  }
}
