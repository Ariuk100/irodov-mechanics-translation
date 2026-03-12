/**
 * One-time script: create or update the first admin account.
 *
 * Usage:
 *   npx tsx scripts/setup-admin.ts
 *
 * Requires .env.local with FIREBASE_ADMIN_* variables.
 */

import * as path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminAuth = getAuth();
const db = getFirestore();

const EMAIL = "ariunbold.bless@gmail.com";
const DISPLAY_NAME = "Ганболд Ариунболд";
const PASSWORD = "changeme123"; // зөвхөн шинэ хэрэглэгч үүсгэхэд хэрэглэнэ

async function main() {
  let uid: string;

  // Firebase Auth дээр хэрэглэгч байгаа эсэхийг шалгана
  try {
    const existing = await adminAuth.getUserByEmail(EMAIL);
    uid = existing.uid;
    console.log(`✓ Хэрэглэгч олдлоо: ${uid}`);

    // Нэрийг шинэчилнэ
    await adminAuth.updateUser(uid, { displayName: DISPLAY_NAME });
    console.log(`✓ Нэр шинэчлэгдлээ: ${DISPLAY_NAME}`);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") {
      // Шинэ хэрэглэгч үүсгэнэ
      const newUser = await adminAuth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: DISPLAY_NAME,
      });
      uid = newUser.uid;
      console.log(`✓ Шинэ хэрэглэгч үүслээ: ${uid}`);
      console.log(`  Нууц үг: ${PASSWORD}  ← нэвтэрсний дараа солино уу`);
    } else {
      throw err;
    }
  }

  // Firestore-д admin роль тохируулна
  await db.collection("users").doc(uid).set(
    {
      uid,
      email: EMAIL,
      displayName: DISPLAY_NAME,
      role: "admin",
      createdAt: Date.now(),
    },
    { merge: true }
  );

  console.log(`\n✅ ${DISPLAY_NAME} (${EMAIL}) admin болгогдлоо!`);
}

main().catch((err) => {
  console.error("Алдаа:", err.message);
  process.exit(1);
});
