import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/reader", "/admin", "/moderator"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const verifyUrl = new URL("/api/auth/verify", req.url);
  const verifyRes = await fetch(verifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session }),
  });

  if (!verifyRes.ok) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const { role } = await verifyRes.json();

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (
    pathname.startsWith("/moderator") &&
    role !== "admin" &&
    role !== "moderator"
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/reader/:path*", "/admin/:path*", "/moderator/:path*"],
};
