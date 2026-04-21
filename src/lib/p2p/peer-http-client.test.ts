import { describe, expect, it } from "vitest";
import { readJsonPeerHTTP, writePeerHTTPRequest } from "./peer-http-client";

describe("peer-http-client", () => {
  it("writes canonical HTTP request and parses JSON response", async () => {
    const writes: string[] = [];
    const stream = {
      async close() {},
      async onDrain() {},
      send(data: Uint8Array) {
        writes.push(new TextDecoder().decode(data));
        return true;
      },
      async *[Symbol.asyncIterator]() {
        yield new TextEncoder().encode(
          "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 12\r\n\r\n{\"ok\":true}\n",
        );
      },
    };

    await writePeerHTTPRequest(stream as never, { method: "GET", path: "/api/android/device_status" });

    expect(writes.join("")).toContain("GET /api/android/device_status HTTP/1.1");
    expect(writes.join("")).toContain("Host: peer-http");
    expect(writes.join("")).toContain("Connection: close");

    const body = await readJsonPeerHTTP(stream as never);

    expect(body).toEqual({ ok: true });
  });
});
