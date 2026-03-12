import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/types/content";

// GET /api/admin/pending — list pending access requests (admin only)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snap = await adminDb.collection("pendingAccess").get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  requests.sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
  return NextResponse.json({ requests });
}

// POST /api/admin/pending — approve or reject a pending request (admin only)
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid, action, role = "user" } = await req.json() as {
    uid: string;
    action: "approve" | "reject";
    role?: UserRole;
  };

  if (!uid || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Prevent granting admin role through this endpoint
  if (action === "approve" && role === "admin") {
    return NextResponse.json({ error: "Admin эрх шинээр өгөх боломжгүй" }, { status: 403 });
  }

  const pendingRef = adminDb.collection("pendingAccess").doc(uid);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "approve") {
    const data = pendingSnap.data()!;
    await adminDb.collection("users").doc(uid).set({
      uid,
      email: data.email ?? "",
      displayName: data.displayName ?? "",
      photoURL: data.photoURL ?? "",
      role,
      createdAt: Date.now(),
    });
  } else {
    // Reject: delete Firebase Auth user so they are fully removed from the system
    await adminAuth.deleteUser(uid).catch(() => {});
  }

  await pendingRef.delete();
  return NextResponse.json({ ok: true });
}
