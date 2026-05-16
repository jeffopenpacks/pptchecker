import {
  DECK_DB_NAME,
  DECK_DB_VERSION,
  DECK_STORE,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_SLIDE,
  NOTES_STORE,
  OVERLAYS_STORE,
} from "./config";
import type { InkStroke, SessionOverlays } from "./overlay-types";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DECK_DB_NAME, DECK_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const v = event.oldVersion;
      if (v < 1 && !db.objectStoreNames.contains(DECK_STORE)) {
        db.createObjectStore(DECK_STORE, { keyPath: "id" });
      }
      if (v < 2 && !db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(OVERLAYS_STORE)) {
        db.createObjectStore(OVERLAYS_STORE, { keyPath: "sessionId" });
      }
    };
  });
}

function sanitiseStroke(stroke: InkStroke): InkStroke | null {
  if (!stroke.points?.length) return null;
  const points = stroke.points.slice(0, MAX_POINTS_PER_STROKE);
  return {
    tool: stroke.tool === "highlighter" ? "highlighter" : "pen",
    color: stroke.color || "#facc15",
    width: Math.min(24, Math.max(1, stroke.width || 3)),
    points,
  };
}

function sanitiseOverlays(data: SessionOverlays): SessionOverlays {
  const bySlide = data.bySlide.map((strokes) =>
    strokes
      .slice(0, MAX_STROKES_PER_SLIDE)
      .map(sanitiseStroke)
      .filter((s): s is InkStroke => s !== null),
  );
  return { sessionId: data.sessionId, bySlide };
}

export async function loadSessionOverlays(
  sessionId: string,
): Promise<SessionOverlays> {
  const db = await openDb();
  const row = await new Promise<SessionOverlays | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(OVERLAYS_STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
      const req = tx.objectStore(OVERLAYS_STORE).get(sessionId);
      req.onsuccess = () => resolve(req.result as SessionOverlays | undefined);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
    },
  );
  db.close();
  return row
    ? sanitiseOverlays(row)
    : { sessionId, bySlide: [] };
}

export async function saveSessionOverlays(
  overlays: SessionOverlays,
): Promise<void> {
  const db = await openDb();
  const clean = sanitiseOverlays(overlays);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OVERLAYS_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(OVERLAYS_STORE).put(clean);
  });
  db.close();
}

export async function deleteSessionOverlays(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OVERLAYS_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    tx.objectStore(OVERLAYS_STORE).delete(sessionId);
  });
  db.close();
}
