import { describe, expect, it, vi } from "vitest";
import { openStreamForAddress } from "./libp2p-stream";

describe("openStreamForAddress", () => {
  it("reuses the same relay circuit connection across sequential streams", async () => {
    const newStream = vi.fn(async () => ({
      [Symbol.asyncIterator]: async function* () {},
      close: async () => undefined,
      onDrain: async () => undefined,
      send: () => true,
    }));
    const dial = vi.fn(async () => ({ newStream }));
    const node = {
      dial,
    };
    const address =
      "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWRelay/p2p-circuit/p2p/12D3KooWAndroid";

    await openStreamForAddress({
      address,
      node,
      protocol: "/gomtm/worker-sb/invoke/1.0.0",
    });
    await openStreamForAddress({
      address,
      node,
      protocol: "/gomtm/worker-sb/stream/1.0.0",
    });

    expect(dial).toHaveBeenCalledTimes(1);
    expect(newStream).toHaveBeenCalledTimes(2);
  });

  it("opens a fresh relay connection when explicitly requested", async () => {
    const newStream = vi.fn(async () => ({
      [Symbol.asyncIterator]: async function* () {},
      close: async () => undefined,
      onDrain: async () => undefined,
      send: () => true,
    }));
    const dial = vi.fn(async () => ({ newStream }));
    const node = {
      dial,
    };
    const address =
      "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/certhash/uEiTest/p2p/12D3KooWRelay/p2p-circuit/p2p/12D3KooWAndroid";

    await openStreamForAddress({
      address,
      freshConnection: true,
      node,
      protocol: "/gomtm/worker-sb/stream/1.0.0",
    });
    await openStreamForAddress({
      address,
      freshConnection: true,
      node,
      protocol: "/gomtm/worker-sb/stream/1.0.0",
    });

    expect(dial).toHaveBeenCalledTimes(2);
    expect(newStream).toHaveBeenCalledTimes(2);
  });

  it("retries direct dialProtocol stream open after a closing-connection error", async () => {
    const stream = {
      [Symbol.asyncIterator]: async function* () {},
      close: async () => undefined,
      onDrain: async () => undefined,
      send: () => true,
    };
    const newStream = vi.fn(async () => stream);
    const dial = vi.fn(async () => ({ newStream }));
    const dialProtocol = vi.fn().mockRejectedValueOnce(new Error('The connection is "closing" and not "open"'));
    const node = {
      dial,
      dialProtocol,
    };
    const address = "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/p2p/12D3KooWAndroid";

    await expect(
      openStreamForAddress({
        address,
        node,
        protocol: "/gomtm/worker-sb/invoke/1.0.0",
      }),
    ).resolves.toBe(stream);

    expect(dialProtocol).toHaveBeenCalledTimes(1);
    expect(dial).toHaveBeenCalledTimes(1);
    expect(newStream).toHaveBeenCalledTimes(1);
  });

  it("retries direct newStream after a stream-closing error", async () => {
    const stream = {
      [Symbol.asyncIterator]: async function* () {},
      close: async () => undefined,
      onDrain: async () => undefined,
      send: () => true,
    };
    const firstConnection = {
      newStream: vi.fn(async () => {
        throw new Error("Cannot write to a stream that is closing");
      }),
    };
    const secondConnection = {
      newStream: vi.fn(async () => stream),
    };
    const dial = vi.fn().mockResolvedValueOnce(firstConnection).mockResolvedValueOnce(secondConnection);
    const node = {
      dial,
    };
    const address = "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/p2p/12D3KooWAndroid";

    await expect(
      openStreamForAddress({
        address,
        node,
        protocol: "/gomtm/worker-sb/stream/1.0.0",
      }),
    ).resolves.toBe(stream);

    expect(dial).toHaveBeenCalledTimes(2);
    expect(firstConnection.newStream).toHaveBeenCalledTimes(1);
    expect(secondConnection.newStream).toHaveBeenCalledTimes(1);
  });

  it("does not fallback to a fresh direct dial on non-transient dialProtocol errors", async () => {
    const dial = vi.fn(async () => ({
      newStream: vi.fn(async () => {
        throw new Error("should not open a fallback stream");
      }),
    }));
    const dialProtocol = vi.fn().mockRejectedValueOnce(new Error("protocol not supported"));
    const node = {
      dial,
      dialProtocol,
    };
    const address = "/ip4/156.233.234.137/udp/4101/quic-v1/webtransport/p2p/12D3KooWAndroid";

    await expect(
      openStreamForAddress({
        address,
        node,
        protocol: "/gomtm/worker-sb/invoke/1.0.0",
      }),
    ).rejects.toThrow("protocol not supported");

    expect(dialProtocol).toHaveBeenCalledTimes(1);
    expect(dial).not.toHaveBeenCalled();
  });
});
