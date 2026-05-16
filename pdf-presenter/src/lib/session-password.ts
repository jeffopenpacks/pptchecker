const PREFIX = "pdf-presenter-pw-";

export function rememberSessionPassword(
  sessionId: string,
  password: string,
): void {
  try {
    sessionStorage.setItem(PREFIX + sessionId, password);
  } catch {
    /* quota or private mode */
  }
}

export function getSessionPassword(sessionId: string): string | undefined {
  try {
    return sessionStorage.getItem(PREFIX + sessionId) ?? undefined;
  } catch {
    return undefined;
  }
}

export function forgetSessionPassword(sessionId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + sessionId);
  } catch {
    /* ignore */
  }
}
