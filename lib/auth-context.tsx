"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { invalidateSection, invalidateLibrary } from "./content";
import type { UserDoc, UserRole } from "@/types/content";

interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to content version changes → invalidate only changed sections
  useEffect(() => {
    const prevVersions: Record<string, number> = {};
    const unsub = onSnapshot(doc(db, "meta", "content_version"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, number>;
      for (const [key, ts] of Object.entries(data)) {
        if (prevVersions[key] !== undefined && prevVersions[key] !== ts) {
          if (key === "__library__") {
            invalidateLibrary();
          } else {
            const [bookId, chapterId, sectionId] = key.split("__");
            if (bookId && chapterId && sectionId) {
              invalidateSection(bookId, chapterId, sectionId);
            }
          }
        }
        prevVersions[key] = ts;
      }
    }, () => {}); // ignore permission errors (not logged in)
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          setUserDoc(snap.data() as UserDoc);
        } else {
          setUserDoc(null);
        }
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    // Only allow pre-registered users (admin must create the account)
    const ref = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Send ID token to server — Admin SDK bypasses Firestore security rules
      const idToken = await firebaseUser.getIdToken();
      await fetch("/api/auth/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }).catch(() => {}); // don't fail if network error
      await firebaseSignOut(auth);
      throw new Error(
        "PENDING_ACCESS:" +
          JSON.stringify({
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName ?? "",
          })
      );
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUserDoc(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        role: userDoc?.role ?? null,
        loading,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
