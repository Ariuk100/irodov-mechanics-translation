import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// Lazy proxies — Firebase Admin is only initialized on first runtime call
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const a = getAuth(getAdminApp());
    return (a as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const d = getFirestore(getAdminApp());
    return (d as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminStorage = new Proxy({} as Storage, {
  get(_target, prop) {
    const s = getStorage(getAdminApp());
    return (s as unknown as Record<string | symbol, unknown>)[prop];
  },
});
