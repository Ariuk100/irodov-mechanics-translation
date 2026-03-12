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

// PATCH /api/suggestions/[id] — approve or reject (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const sectionSnap = await sectionRef.get();
  if (!sectionSnap.exists) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const rawBody = sectionSnap.data()!.body;
  const body: BodyBlock[] = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  let updatedBody: BodyBlock[] = body;
  let replaced = false;

  // ── Text suggestion ────────────────────────────────────────────────────────
  if (suggType === "text") {
    const finalText: string = editedSuggestedText ?? sugg.suggestedText;
    const originalText: string = sugg.originalText;
    updatedBody = body.map((block, index) => {
      if (blockIndex >= 0 && index !== blockIndex) return block;
      if (block.type === "text" || block.type === "note") {
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

  // ── Formula suggestion ─────────────────────────────────────────────────────
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

  // ── Image suggestion ───────────────────────────────────────────────────────
  else if (suggType === "image") {
    const imageAction: string = sugg.imageAction ?? "replace";

    if (imageAction === "delete") {
      // Remove the image block entirely
      updatedBody = body.filter((_, index) => index !== blockIndex);
      replaced = true;
      // Clean up temp storage (no temp file for delete action)
    } else if (imageAction === "replace" || imageAction === "insert") {
      // Move temp image to permanent location
      const tempPath: string = sugg.tempImagePath;
      if (!tempPath) {
        return NextResponse.json({ error: "Missing tempImagePath" }, { status: 400 });
      }
      const ext = tempPath.split(".").pop() ?? "jpg";
      const permanentPath = `books/${sugg.bookId}/${sugg.sectionId}_${Date.now()}.${ext}`;
      const permanentUrl = await moveStorageFile(tempPath, permanentPath);

      if (imageAction === "replace") {
        updatedBody = body.map((block, index) => {
          if (index !== blockIndex) return block;
          if (block.type === "image") {
            replaced = true;
            return { ...block, src: permanentUrl } as ImageBlock;
          }
          return block;
        });
      } else {
        // insert: add new ImageBlock at blockIndex (or end if -1)
        const newBlock: ImageBlock = { type: "image", src: permanentUrl, caption: sugg.suggestedText || undefined };
        if (blockIndex < 0 || blockIndex >= body.length) {
          updatedBody = [...body, newBlock];
        } else {
          updatedBody = [...body.slice(0, blockIndex), newBlock, ...body.slice(blockIndex)];
        }
        replaced = true;
      }
    }
  }

  if (!replaced) {
    console.warn(`[suggestions] Could not apply suggestion. id=${id}, type=${suggType}, blockIndex=${blockIndex}`);
  }

  await sectionRef.update({ body: JSON.stringify(updatedBody), updatedAt: Date.now() });
  await suggRef.update({
    status: "approved",
    suggestedText: editedSuggestedText ?? sugg.suggestedText,
    reviewedAt: Date.now(),
    reviewedBy: decoded.uid,
    tempImagePath: null, // clear temp path after move
  });

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
