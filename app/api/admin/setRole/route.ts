import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/types/content";

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid, role } = await req.json();
  const allowedRoles: UserRole[] = ["moderator", "user"];

  // Prevent admin from changing their own role
  if (uid === decoded.uid) {
    return NextResponse.json({ error: "Өөрийнхөө эрхийг солих боломжгүй" }, { status: 403 });
  }
  // Prevent promoting anyone to admin
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Admin эрх шинээр өгөх боломжгүй" }, { status: 403 });
  }

  await adminDb.collection("users").doc(uid).update({ role });
  // Embed role as a Firebase custom claim so future session verifications
  // skip the Firestore read entirely (JWT-only verification)
  await adminAuth.setCustomUserClaims(uid, { role }).catch(() => {});
  return NextResponse.json({ ok: true });
}
