export function overlaysChannelName(sessionId: string): string {
  return `pdf-presenter-overlays-${sessionId}`;
}

export function broadcastOverlaysUpdated(sessionId: string): void {
  try {
    const ch = new BroadcastChannel(overlaysChannelName(sessionId));
    ch.postMessage({ type: "updated" });
    ch.close();
  } catch {
    /* ignore */
  }
}
