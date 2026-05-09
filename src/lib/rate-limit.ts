import {
  ANALYSE_RATE_LIMIT_MAX,
  ANALYSE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/pptx/config";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 8000;

function pruneBuckets(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (now - b.windowStart > ANALYSE_RATE_LIMIT_WINDOW_MS * 2) {
      buckets.delete(key);
    }
  }
}

/** Best-effort client key for unauthenticated routes (shared NAT caveat). */
export function analyseClientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function allowAnalyseRequest(request: Request): boolean {
  const key = analyseClientKey(request);
  const now = Date.now();
  pruneBuckets(now);

  let b = buckets.get(key);
  if (!b || now - b.windowStart >= ANALYSE_RATE_LIMIT_WINDOW_MS) {
    b = { count: 1, windowStart: now };
    buckets.set(key, b);
    return true;
  }

  if (b.count >= ANALYSE_RATE_LIMIT_MAX) return false;
  b.count++;
  return true;
}

/** Test helper — clears in-memory counters. */
export function resetAnalyseRateLimitForTests() {
  buckets.clear();
}
