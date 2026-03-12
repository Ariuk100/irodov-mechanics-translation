import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { session } = await req.json();
    if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);

    // Fast path: role embedded as a custom claim (no Firestore read)
    const claimRole = (decoded as Record<string, unknown>).role as string | undefined;
    if (claimRole) {
      return NextResponse.json({ uid: decoded.uid, role: claimRole });
    }

    // Slow path: first login after role assignment (claim not yet in session)
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userSnap.exists ? (userSnap.data()?.role ?? "user") : "user";

    return NextResponse.json({ uid: decoded.uid, role });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
