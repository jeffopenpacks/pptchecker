import { analysePptx } from "@/lib/pptx/analyse";
import { MAX_UPLOAD_BYTES } from "@/lib/pptx/config";

export const runtime = "nodejs";

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

export async function POST(request: Request) {
  try {
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
        { ok: false, error: "Only .pptx files are accepted." },
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
  } catch {
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
