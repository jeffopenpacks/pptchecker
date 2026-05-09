import { analysePptx } from "@/lib/pptx/analyse";
import { MAX_UPLOAD_BYTES } from "@/lib/pptx/config";
import { allowAnalyseRequest } from "@/lib/rate-limit";
import { logServerWarn } from "@/lib/server-log";

export const runtime = "nodejs";

/** Align with route workload (ZIP + XML); platform may still impose lower ceilings. */
export const maxDuration = 55;

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

export async function POST(request: Request) {
  try {
    if (!allowAnalyseRequest(request)) {
      logServerWarn({
        event: "analyse_rate_limited",
        clientKeyPrefix: clientKeySafe(request),
      });
      return Response.json(
        {
          ok: false,
          error:
            "Too many analysis requests from this address. Try again in about a minute.",
        },
        { status: 429 },
      );
    }

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return Response.json(
        { ok: false, error: "Expected multipart/form-data with a file field." },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { ok: false, error: 'Missing file upload (expected field name "file").' },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".pptx")) {
      return Response.json(
        {
          ok: false,
          error:
            "Only .pptx files are accepted by extension — content is still validated as a ZIP package.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          ok: false,
          error: `File exceeds the ${MAX_MB} MB limit.`,
        },
        { status: 400 },
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = analysePptx(buffer);
    return Response.json(result);
  } catch (e) {
    logServerWarn({
      event: "analyse_route_error",
      message: e instanceof Error ? e.message : String(e),
    });
    return Response.json(
      {
        ok: false,
        error:
          "Analysis failed. The upload may be corrupt, truncated, or blocked by the host.",
      },
      { status: 500 },
    );
  }
}

function clientKeySafe(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const raw =
    fwd?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";
  return raw.length > 40 ? `${raw.slice(0, 8)}…` : raw;
}
