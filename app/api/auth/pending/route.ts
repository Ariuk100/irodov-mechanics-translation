import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// POST /api/auth/pending — save a pending access request using Admin SDK
// Called client-side right after Google sign-in, before sign-out
export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  // Verify the ID token to get the user's data
  const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { uid, email, name, picture } = decoded;

  // If they already exist in users collection, don't add to pending
  const userSnap = await adminDb.collection("users").doc(uid).get();
  if (userSnap.exists) {
    return NextResponse.json({ status: "already_exists" });
  }

  // If already pending, don't overwrite (idempotent)
  const pendingRef = adminDb.collection("pendingAccess").doc(uid);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    await pendingRef.set({
      uid,
      email: email ?? "",
      displayName: name ?? "",
      photoURL: picture ?? "",
      requestedAt: Date.now(),
    });
  }

  return NextResponse.json({ status: "pending" });
}
