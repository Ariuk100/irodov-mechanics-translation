import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// POST /api/auth/session  — exchange ID token for session cookie
export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  // 5-day session
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresIn / 1000,
    path: "/",
    sameSite: "lax",
  });
  return res;
}

// DELETE /api/auth/session — clear session cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { maxAge: 0, path: "/" });
  return res;
}
