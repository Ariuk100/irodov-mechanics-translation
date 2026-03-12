/**
 * Firestore security rules-ийг REST API-аар deploy хийнэ.
 * Usage: npx tsx scripts/deploy-rules.ts
 */
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { GoogleAuth } from "google-auth-library";

config({ path: path.resolve(process.cwd(), ".env.local") });

const PROJECT = "books-57613";
const RULES_FILE = path.resolve(process.cwd(), "firestore.rules");
const rules = fs.readFileSync(RULES_FILE, "utf-8");

async function getToken() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

async function main() {
  const token = await getToken();
  const base = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

  // 1. Ruleset үүсгэнэ
  console.log("Ruleset үүсгэж байна...");
  const createRes = await fetch(`${base}/rulesets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: {
        files: [{ name: "firestore.rules", content: rules }],
      },
    }),
  });
  if (!createRes.ok) throw new Error(`Ruleset үүсгэхэд алдаа: ${await createRes.text()}`);
  const { name: rulesetName } = await createRes.json();
  console.log(`✓ Ruleset: ${rulesetName}`);

  // 2. Release үүсгэх / шинэчлэх
  const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
  console.log("Release шинэчилж байна...");

  // Байгаа release-г шалгана
  const getRes = await fetch(`${base}/releases/cloud.firestore`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (getRes.ok) {
    // Patch
    const patchRes = await fetch(
      `${base}/releases/cloud.firestore`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ release: { name: releaseName, rulesetName } }),
      }
    );
    if (!patchRes.ok) throw new Error(`Release шинэчлэхэд алдаа: ${await patchRes.text()}`);
  } else {
    // Create
    const releaseRes = await fetch(`${base}/releases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: releaseName, rulesetName }),
    });
    if (!releaseRes.ok) throw new Error(`Release үүсгэхэд алдаа: ${await releaseRes.text()}`);
  }

  console.log("\n✅ Firestore rules амжилттай deploy хийгдлээ!");
}

main().catch((e) => { console.error("Алдаа:", e.message); process.exit(1); });
