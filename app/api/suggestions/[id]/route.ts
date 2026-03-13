import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";
import { createNotification } from "@/lib/notifications";
import type { BodyBlock, ImageBlock } from "@/types/content";

// Strip HTML tags to get plain text for comparison
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// Replace `oldText` with `newText` inside an HTML string.
function replaceInHtml(html: string, oldText: string, newText: string): string | null {
  if (html.includes(oldText)) return html.replace(oldText, newText);
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const interleaved = escaped.split("").join("(?:<[^>]*>)*");
  const regex = new RegExp(interleaved);
  if (regex.test(html)) return html.replace(regex, newText);
  return null;
}

// Delete a file from Firebase Storage (silent on failure)
async function deleteStorageFile(path: string) {
  try {
    await adminStorage.bucket().file(path).delete();
  } catch {
    console.warn(`[storage] Failed to delete temp file: ${path}`);
  }
}

// Move a Storage file from temp path to permanent path
async function moveStorageFile(
  tempPath: string,
  permanentPath: string
): Promise<string> {
  const bucket = adminStorage.bucket();
  await bucket.file(tempPath).move(permanentPath);
  await bucket.file(permanentPath).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${permanentPath}`;
}

/** Custom error that carries an HTTP status code */
class AppError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = "AppError";
  }
}

// PATCH /api/suggestions/[id] — approve or reject (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params;
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (callerSnap.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { action, suggestedText: editedSuggestedText } = await req.json();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const suggRef = adminDb.collection("suggestions").doc(id);
  const suggSnap = await suggRef.get();
  if (!suggSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sugg = suggSnap.data()!;
  const suggType: string = sugg.type ?? "text";
  const blockIndex: number = sugg.blockIndex ?? -1;

  // Guard: chapterId must exist (older suggestions may not have it)
  if (!sugg.chapterId) {
    console.error(`[suggestions] Missing chapterId on suggestion ${id}`);
    return NextResponse.json({ error: "Suggestion is missing chapterId — cannot locate section" }, { status: 422 });
  }

  // ── REJECT ─────────────────────────────────────────────────────────────────
  if (action === "reject") {
    // Clean up temp image if any
    if (suggType === "image" && sugg.tempImagePath) {
      await deleteStorageFile(sugg.tempImagePath);
    }
    await suggRef.update({
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: decoded.uid,
    });
    // Notify the suggestion author
    if (sugg.authorId) {
      const adminName = callerSnap.data()?.displayName || callerSnap.data()?.email || "Админ";
      createNotification({
        recipientUid: sugg.authorId,
        type: "suggestion_rejected",
        title: "Таны санал татгалзагдлаа",
        body: `${adminName} таны орчуулгын саналыг татгалзлаа (${sugg.sectionId})`,
        suggestionId: id,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // ── APPROVE ────────────────────────────────────────────────────────────────
  const sectionRef = adminDb
    .collection("books").doc(sugg.bookId)
    .collection("chapters").doc(sugg.chapterId)
    .collection("sections").doc(sugg.sectionId);

  // ── Title suggestion (single-field update, no body read-modify-write needed) ─
  if (suggType === "title") {
    const newTitle: string = editedSuggestedText ?? sugg.suggestedText;
    const nowTsTitle = Date.now();
    await sectionRef.update({ title: newTitle, updatedAt: nowTsTitle });
    const sectionKeyTitle = `${sugg.bookId}__${sugg.chapterId}__${sugg.sectionId}`;
    adminDb.collection("meta").doc("content_version").set(
      { [sectionKeyTitle]: nowTsTitle, "__library__": nowTsTitle },
      { merge: true }
    ).catch(() => {});
    await suggRef.update({
      status: "approved",
      suggestedText: editedSuggestedText ?? sugg.suggestedText,
      reviewedAt: nowTsTitle,
      reviewedBy: decoded.uid,
    });
    if (sugg.authorId) {
      const adminName = callerSnap.data()?.displayName || callerSnap.data()?.email || "Админ";
      createNotification({
        recipientUid: sugg.authorId,
        type: "suggestion_approved",
        title: "Таны санал батлагдлаа 🎉",
        body: `${adminName} таны гарчиг засах саналыг баталж нэмлээ (${sugg.sectionId})`,
        suggestionId: id,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // ── Pre-transaction: move image to permanent storage if needed ────────────
  // (Storage operations cannot run inside a Firestore transaction)
  let permanentUrl: string | undefined;
  let permanentPath: string | undefined;
  let localPath: string | undefined;

  if (suggType === "image") {
    const imageAction: string = sugg.imageAction ?? "replace";
    if (imageAction === "replace" || imageAction === "insert") {
      const tempPath: string = sugg.tempImagePath;
      if (!tempPath) {
        return NextResponse.json({ error: "Missing tempImagePath" }, { status: 400 });
      }
      const ext = tempPath.split(".").pop() ?? "jpg";
      permanentPath = `books/${sugg.bookId}/${sugg.sectionId}_${Date.now()}.${ext}`;
      permanentUrl = await moveStorageFile(tempPath, permanentPath);
      const permanentFilename = permanentPath.split("/").pop()!;
      localPath = `images/${sugg.bookId}/${permanentFilename}`;
    }
  }

  // ── Atomic read-modify-write via Firestore transaction ─────────────────────
  // This guarantees no concurrent approval can overwrite another's changes.
  // If the block cannot be found/replaced, the transaction is aborted with 409.
  const nowTs = await adminDb.runTransaction(async (tx) => {
    const sectionSnap = await tx.get(sectionRef);
    if (!sectionSnap.exists) {
      throw new AppError("Section not found", 404);
    }

    const rawBody = sectionSnap.data()!.body;
    const body: BodyBlock[] = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    let updatedBody: BodyBlock[] = body;
    let replaced = false;

    // ── Text ────────────────────────────────────────────────────────────────
    if (suggType === "text") {
      const finalText: string = editedSuggestedText ?? sugg.suggestedText;

      if (sugg.textAction === "insert") {
        // Insert a new text block at blockIndex (or append to end)
        const newBlock: BodyBlock = { type: "text", value: finalText };
        if (blockIndex < 0 || blockIndex >= body.length) {
          updatedBody = [...body, newBlock];
        } else {
          updatedBody = [...body.slice(0, blockIndex), newBlock, ...body.slice(blockIndex)];
        }
        replaced = true;
      } else {
        const originalText: string = sugg.originalText;
        updatedBody = body.map((block, index) => {
          if (blockIndex >= 0 && index !== blockIndex) return block;
          if (block.type === "header") {
            // Header values are plain text — direct replace
            if (block.value === originalText || block.value.includes(originalText)) {
              replaced = true;
              return { ...block, value: block.value === originalText ? finalText : block.value.replace(originalText, finalText) };
            }
          } else if (block.type === "text" || block.type === "note") {
            const result = replaceInHtml(block.value, originalText, finalText);
            if (result !== null) { replaced = true; return { ...block, value: result }; }
            const plain = stripHtml(block.value);
            if (plain.includes(originalText)) {
              replaced = true;
              return { ...block, value: plain.replace(originalText, finalText) };
            }
          }
          return block;
        });
      }
    }

    // ── Block delete ─────────────────────────────────────────────────────────
    else if (suggType === "block_delete") {
      if (blockIndex >= 0 && blockIndex < body.length) {
        updatedBody = body.filter((_, index) => index !== blockIndex);
        replaced = true;
      }
    }

    // ── Formula ──────────────────────────────────────────────────────────────
    else if (suggType === "formula") {
      const newLatex: string = editedSuggestedText ?? sugg.suggestedText;
      updatedBody = body.map((block, index) => {
        if (index !== blockIndex) return block;
        if (block.type === "equation") {
          replaced = true;
          return { ...block, value: newLatex };
        }
        return block;
      });
    }

    // ── Image ────────────────────────────────────────────────────────────────
    else if (suggType === "image") {
      const imageAction: string = sugg.imageAction ?? "replace";

      if (imageAction === "delete") {
        // Remove the image block entirely
        updatedBody = body.filter((_, index) => index !== blockIndex);
        replaced = true;
      } else if (imageAction === "replace") {
        updatedBody = body.map((block, index) => {
          if (index !== blockIndex) return block;
          if (block.type === "image") {
            replaced = true;
            return { ...block, src: permanentUrl } as ImageBlock;
          }
          return block;
        });
      } else if (imageAction === "insert") {
        // insert: add new ImageBlock at blockIndex (or end if -1)
        const newBlock: ImageBlock = { type: "image", src: permanentUrl!, caption: sugg.suggestedText || undefined };
        if (blockIndex < 0 || blockIndex >= body.length) {
          updatedBody = [...body, newBlock];
        } else {
          updatedBody = [...body.slice(0, blockIndex), newBlock, ...body.slice(blockIndex)];
        }
        replaced = true;
      }
    }

    // ── Abort if nothing was replaced ────────────────────────────────────────
    if (!replaced) {
      throw new AppError(
        `Блокийн агуулга тохирохгүй байна — контент өөрчлөгдсөн байж болзошгүй (type=${suggType}, blockIndex=${blockIndex})`,
        409
      );
    }

    // ── Write section body + mark suggestion approved (atomic) ────────────────
    const ts = Date.now();
    tx.update(sectionRef, { body: JSON.stringify(updatedBody), updatedAt: ts });
    tx.update(suggRef, {
      status: "approved",
      suggestedText: editedSuggestedText ?? sugg.suggestedText,
      reviewedAt: ts,
      reviewedBy: decoded.uid,
      tempImagePath: null,
    });
    return ts;
  });

  // ── Post-transaction: bump content version so readers invalidate cache ─────
  const sectionKey = `${sugg.bookId}__${sugg.chapterId}__${sugg.sectionId}`;
  adminDb.collection("meta").doc("content_version").set(
    { [sectionKey]: nowTs, "__library__": nowTs },
    { merge: true }
  ).catch(() => {});

  // Log image metadata for later migration to public/images/
  if (suggType === "image" && sugg.imageAction !== "delete" && permanentPath && permanentUrl) {
    const imageAction: string = sugg.imageAction ?? "replace";
    adminDb.collection("addedImages").add({
      storagePath: permanentPath,
      storageUrl: permanentUrl,
      localPath,
      bookId: sugg.bookId,
      chapterId: sugg.chapterId,
      sectionId: sugg.sectionId,
      imageAction,
      addedAt: nowTs,
      addedBy: decoded.uid,
      suggestionId: id,
    }).catch(() => {});
  }

  // Track local image path for deleted images
  if (suggType === "image" && sugg.imageAction === "delete") {
    const deletedSrc: string = sugg.originalText ?? "";
    if (deletedSrc && !deletedSrc.startsWith("http")) {
      adminDb.collection("deletedImages").add({
        path: deletedSrc,
        bookId: sugg.bookId,
        sectionId: sugg.sectionId,
        deletedAt: nowTs,
        deletedBy: decoded.uid,
        suggestionId: id,
      }).catch(() => {});
    }
  }

  // Notify the suggestion author
  if (sugg.authorId) {
    const adminName = callerSnap.data()?.displayName || callerSnap.data()?.email || "Админ";
    createNotification({
      recipientUid: sugg.authorId,
      type: "suggestion_approved",
      title: "Таны санал батлагдлаа 🎉",
      body: `${adminName} таны орчуулгын саналыг баталж контентод нэмлээ (${sugg.sectionId})`,
      suggestionId: id,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    const status = err instanceof AppError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[suggestions PATCH] Error:", msg);
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/suggestions/[id] — admin or own moderator can delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = req.cookies.get("session")?.value;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = callerSnap.data()?.role;
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const suggRef = adminDb.collection("suggestions").doc(id);
  const suggSnap = await suggRef.get();
  if (!suggSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const suggData = suggSnap.data()!;

  // Moderator can only delete their own PENDING suggestions
  if (role === "moderator") {
    if (suggData.authorId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (suggData.status !== "pending") {
      return NextResponse.json({ error: "Батлагдсан саналыг зөвхөн админ устгана" }, { status: 403 });
    }
  }

  // Clean up temp image if any
  if (suggData.type === "image" && suggData.tempImagePath) {
    await deleteStorageFile(suggData.tempImagePath);
  }

  await suggRef.delete();
  return NextResponse.json({ ok: true });
}
