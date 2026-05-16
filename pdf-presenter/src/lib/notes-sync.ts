export function notesChannelName(sessionId: string): string {
  return `pdf-presenter-notes-${sessionId}`;
}

export function broadcastNotesUpdated(sessionId: string): void {
  try {
    const ch = new BroadcastChannel(notesChannelName(sessionId));
    ch.postMessage({ type: "updated" });
    ch.close();
  } catch {
    /* BroadcastChannel unavailable */
  }
}
