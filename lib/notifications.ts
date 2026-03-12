/**
 * Server-side notification helpers (Admin SDK only — never import on client).
 */
import { adminDb } from "@/lib/firebase-admin";
import type { NotifType } from "@/types/content";

interface CreateNotifParams {
  recipientUid: string;
  type: NotifType;
  title: string;
  body: string;
  suggestionId?: string;
}

/** Create a single notification document. */
export async function createNotification(params: CreateNotifParams) {
  await adminDb.collection("notifications").add({
    ...params,
    read: false,
    createdAt: Date.now(),
  });
}

/** Notify every admin user. */
export async function notifyAllAdmins(
  params: Omit<CreateNotifParams, "recipientUid">
) {
  const snap = await adminDb
    .collection("users")
    .where("role", "==", "admin")
    .get();
  await Promise.all(
    snap.docs.map((d) =>
      createNotification({ ...params, recipientUid: d.id })
    )
  );
}
