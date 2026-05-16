import {
  DECK_DB_NAME,
  DECK_DB_VERSION,
  DECK_STORE,
  NOTES_STORE,
  OVERLAYS_STORE,
} from "./config";
import { deleteSessionOverlays } from "./overlay-store";
import { deleteSessionNotes } from "./notes-store";
import type { DeckSessionMeta } from "./types";

export type StoredSession = DeckSessionMeta & {
  pdfBytes: ArrayBuffer;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DECK_DB_NAME, DECK_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1 && !db.objectStoreNames.contains(DECK_STORE)) {
        db.createObjectStore(DECK_STORE, { keyPath: "id" });
      }
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(OVERLAYS_STORE)) {
        db.createObjectStore(OVERLAYS_STORE, { keyPath: "sessionId" });
      }
    };
  });
}

export async function saveDeckSession(
  session: StoredSession,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DECK_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(DECK_STORE).put(session);
  });
  db.close();
}

export async function loadDeckSession(
  id: string,
): Promise<StoredSession | null> {
  const db = await openDb();
  const row = await new Promise<StoredSession | undefined>((resolve, reject) => {
    const tx = db.transaction(DECK_STORE, "readonly");
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
    const req = tx.objectStore(DECK_STORE).get(id);
    req.onsuccess = () => resolve(req.result as StoredSession | undefined);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
  db.close();
  return row ?? null;
}

export async function deleteDeckSession(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DECK_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    tx.objectStore(DECK_STORE).delete(id);
  });
  db.close();
  await deleteSessionNotes(id);
  await deleteSessionOverlays(id);
}

export function newSessionId(): string {
  return crypto.randomUUID();
}
