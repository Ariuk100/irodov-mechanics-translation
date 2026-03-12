import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";

// POST /api/suggestions/upload-image
// Uploads a moderator's image to Firebase Storage as a temp file.
// Returns { tempImageUrl, tempImagePath }
export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = callerSnap.data()?.role;
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Зөвшөөрөгдсөн форматгүй зураг" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Зурагийн хэмжээ 10MB-аас бага байх ёстой" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const timestamp = Date.now();
  const storagePath = `suggestions/temp/${decoded.uid}/${timestamp}.${ext}`;

  const bucket = adminStorage.bucket();
  const fileRef = bucket.file(storagePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fileRef.save(buffer, {
    metadata: { contentType: file.type },
  });

  // Make the file publicly readable
  await fileRef.makePublic();
  const tempImageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  return NextResponse.json({ tempImageUrl, tempImagePath: storagePath });
}
