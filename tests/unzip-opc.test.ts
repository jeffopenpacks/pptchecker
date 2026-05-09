import { describe, expect, it } from "vitest";

import { unzipOpcLimited } from "@/lib/pptx/unzip-opc";

describe("unzipOpcLimited", () => {
  it("rejects obvious non-ZIP buffers", () => {
    const r = unzipOpcLimited(new Uint8Array([1, 2, 3, 4]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ZIP|signature/i);
  });
});
