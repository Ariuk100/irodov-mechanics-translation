/**
 * CLI: Import all JSON book files → Firebase Firestore
 *
 * Usage:
 *   npx tsx scripts/import-to-firestore.ts
 *
 * Requires .env.local with FIREBASE_ADMIN_* variables.
 */

import * as path from "path";
import * as fs from "fs";
import { config } from "dotenv";

// Load .env.local
config({ path: path.resolve(process.cwd(), ".env.local") });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";
import type { Library, BookDoc, SectionDoc, ChapterMeta } from "../types/content";

// ---- Firebase Admin init ----
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const DATA_DIR = path.resolve(process.cwd(), "public/data");

// ---- Helpers ----
function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function flushBatch(batch: WriteBatch, count: { n: number }) {
  if (count.n > 0) {
    await batch.commit();
    count.n = 0;
  }
}

// Firestore batch max is 500 writes
const BATCH_LIMIT = 400;

// ---- Main ----
async function main() {
  const library = readJson<Library>(path.join(DATA_DIR, "library.json"));

  let batch = db.batch();
  const count = { n: 0 };

  async function addWrite(ref: FirebaseFirestore.DocumentReference, data: object) {
    batch.set(ref, data, { merge: false });
    count.n++;
    if (count.n >= BATCH_LIMIT) {
      console.log(`  Flushing batch (${count.n} writes)...`);
      await flushBatch(batch, count);
      batch = db.batch();
    }
  }

  for (const book of library.books) {
    console.log(`\nImporting book: ${book.id} — ${book.title}`);

    // Write book metadata doc (chapters list without body data)
    const bookDoc: BookDoc = {
      id: book.id,
      title: book.title,
      chapters: book.chapters,
    };
    const bookRef = db.collection("books").doc(book.id);
    await addWrite(bookRef, bookDoc);

    for (const chapter of book.chapters) {
      console.log(`  Chapter: ${chapter.id}`);

      for (const sectionMeta of chapter.sections) {
        const sectionFile = path.join(DATA_DIR, chapter.folder, sectionMeta.file);

        if (!fs.existsSync(sectionFile)) {
          console.warn(`    [SKIP] File not found: ${sectionFile}`);
          continue;
        }

        const sectionData = readJson<{ id: string; title: string; body: unknown[] }>(
          sectionFile
        );

        const sectionDoc = {
          id: sectionMeta.id,
          title: sectionMeta.title,
          chapterId: chapter.id,
          bookId: book.id,
          // JSON.stringify avoids Firestore "nested array" limitation
          body: JSON.stringify(sectionData.body),
          updatedAt: Date.now(),
        };

        const sectionRef = bookRef
          .collection("chapters")
          .doc(chapter.id)
          .collection("sections")
          .doc(sectionMeta.id);

        await addWrite(sectionRef, sectionDoc);
        console.log(`    ✓ ${sectionMeta.id}: ${sectionMeta.title}`);
      }
    }
  }

  // Flush remaining writes
  await flushBatch(batch, count);
  console.log("\n✅ Import complete!");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
