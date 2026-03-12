import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserDoc } from "@/types/content";

// GET /api/admin/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snap = await adminDb.collection("users").orderBy("createdAt", "desc").get();
  const users: UserDoc[] = snap.docs.map((d) => d.data() as UserDoc);
  return NextResponse.json({ users });
}

// POST /api/admin/users — create a user manually (admin only)
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password, displayName, role } = await req.json();
  if (!email || !password || !displayName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  let newUser;
  try {
    newUser = await adminAuth.createUser({ email, password, displayName });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Энэ и-мэйл аль хэдийн бүртгэлтэй байна" }, { status: 409 });
    }
    if (code === "auth/weak-password") {
      return NextResponse.json({ error: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }, { status: 400 });
    }
    return NextResponse.json({ error: "Хэрэглэгч үүсгэхэд алдаа гарлаа" }, { status: 500 });
  }

  const userDoc: UserDoc = {
    uid: newUser.uid,
    email,
    displayName,
    role: role ?? "user",
    createdAt: Date.now(),
  };
  await adminDb.collection("users").doc(newUser.uid).set(userDoc);
  return NextResponse.json({ user: userDoc }, { status: 201 });
}

// DELETE /api/admin/users — delete a user (admin only)
export async function DELETE(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetUid = searchParams.get("uid");
  if (!targetUid) return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
  if (targetUid === decoded.uid) return NextResponse.json({ error: "Өөрийгөө устгах боломжгүй" }, { status: 400 });

  try {
    await adminAuth.deleteUser(targetUid);
    await adminDb.collection("users").doc(targetUid).delete();
    // (Optional) Could also delete suggestions by this user or replace their name, but usually just deleting the auth/doc is enough for MVP.
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message || "Failed to delete user" }, { status: 500 });
  }
}
