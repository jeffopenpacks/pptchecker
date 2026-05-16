import {
  DECK_DB_NAME,
  DECK_DB_VERSION,
  DECK_STORE,
  NOTES_STORE,
  OVERLAYS_STORE,
} from "./config";

export type SessionNotes = {
  sessionId: string;
  /** Index 0 = slide 1. Sparse entries allowed. */
  bySlide: string[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DECK_DB_NAME, DECK_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      if (oldVersion < 1 && !db.objectStoreNames.contains(DECK_STORE)) {
        db.createObjectStore(DECK_STORE, { keyPath: "id" });
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(OVERLAYS_STORE)) {
        db.createObjectStore(OVERLAYS_STORE, { keyPath: "sessionId" });
      }
    };
  });
}

function emptyNotes(sessionId: string): SessionNotes {
  return { sessionId, bySlide: [] };
}

export async function loadSessionNotes(
  sessionId: string,
): Promise<SessionNotes> {
  const db = await openDb();
  const row = await new Promise<SessionNotes | undefined>((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, "readonly");
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
    const req = tx.objectStore(NOTES_STORE).get(sessionId);
    req.onsuccess = () => resolve(req.result as SessionNotes | undefined);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
  db.close();
  return row ?? emptyNotes(sessionId);
}

export async function saveSessionNotes(notes: SessionNotes): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(NOTES_STORE).put(notes);
  });
  db.close();
}

export async function deleteSessionNotes(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    tx.objectStore(NOTES_STORE).delete(sessionId);
  });
  db.close();
}
