import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody, readLimitedBytes } from "../../apps/platform/src/server/security/http";

describe("streaming HTTP body limits", () => {
  it("rejects a chunked body before retaining bytes beyond the limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });
    const request = new Request("https://api.example.test/upload", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readLimitedBytes(request, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("parses a bounded JSON request", async () => {
    const request = new Request("https://api.example.test/admin", {
      method: "POST",
      body: JSON.stringify({ operation: "safe" }),
    });
    await expect(readJsonBody(request, 1_024)).resolves.toEqual({ operation: "safe" });
  });
});
