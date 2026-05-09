/** Structured stderr logs — avoid leaking stack/details to HTTP clients. */

export function logServerWarn(payload: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      ...payload,
    }),
  );
}
