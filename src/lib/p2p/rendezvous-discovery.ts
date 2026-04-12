import type { AbortOptions, PeerId } from "@libp2p/interface";
import { peerDiscoverySymbol } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import { PeerRecord, RecordEnvelope } from "@libp2p/peer-record";
import { multiaddr } from "@multiformats/multiaddr";
import { decodeMessage, encodeMessage } from "protons-runtime";
import type { PeerCandidate } from "./discovery-contracts";
import type { BrowserProtocolStream, StreamChunk } from "./libp2p-stream";
import { chunkToUint8Array } from "./libp2p-stream";
import {
  type RendezvousMessage,
  RendezvousMessageType,
  type RendezvousRegisterMessage,
  RendezvousResponseStatus,
  rendezvousMessageCodec,
} from "./rendezvous-pb";

export const RENDEZVOUS_PROTOCOL = "/gomtm/rendezvous/1.0.0";
export const GOMTM_RENDEZVOUS_NAMESPACE = "gomtm/v1/workers";

export type RendezvousPeerRegistration = {
  peerId: string;
  sourcePeerId: string;
  discoveredAt: string;
  expiresAt: string;
  multiaddrs: string[];
};

type RendezvousDiscoveryInit = {
  fullReconcileIntervalMs?: number;
  incrementalPollIntervalMs?: number;
  namespace?: string;
  points: string[];
};

type ConnectionManagerLike = {
  openStream: (
    peer: ReturnType<typeof multiaddr>,
    protocol: string | string[],
    options?: { priority?: number; runOnLimitedConnection?: boolean },
  ) => Promise<BrowserProtocolStream>;
};

type PeerStoreLike = {
  consumePeerRecord: (buf: Uint8Array, options?: AbortOptions & { expectedPeer?: PeerId }) => Promise<boolean>;
};

type RendezvousDiscoveryComponents = {
  connectionManager: ConnectionManagerLike;
  peerId: { toString: () => string };
  peerStore: PeerStoreLike;
};

export type BrowserRendezvousDiscoveryService = EventTarget & {
  [peerDiscoverySymbol]: EventTarget;
  awaitReady: () => Promise<void>;
  listPeerCandidates: () => Promise<PeerCandidate[]>;
};

export function buildPeerCandidateFromRendezvousRegistration(registration: RendezvousPeerRegistration): PeerCandidate {
  return {
    peerId: registration.peerId,
    multiaddrs: registration.multiaddrs.map((value) => value.trim()).filter((value) => value !== ""),
    lastDiscoveredAt: registration.discoveredAt,
  };
}

type DiscoveredRegistrationUpdate = {
  registration: RendezvousPeerRegistration;
  signedPeerRecord: Uint8Array;
};

function extractPeerIdFromMultiaddrString(value: string) {
  const components = multiaddr(value).getComponents();
  const peerComponent = [...components].reverse().find((component) => component.name === "p2p");
  return peerComponent?.value?.trim() ?? "";
}

function encodeUnsignedVarint(value: number) {
  const bytes = [] as number[];
  let remaining = Math.max(0, Math.floor(value));
  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return Uint8Array.from(bytes);
}

function readUnsignedVarint(buffer: Uint8Array) {
  let value = 0;
  let shift = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte == null) {
      return null;
    }
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { length: index + 1, value };
    }
    shift += 7;
  }
  return null;
}

function mergeUint8Arrays(left: Uint8Array, right: Uint8Array) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left, 0);
  merged.set(right, left.length);
  return merged;
}

async function writeDelimitedRendezvousMessage(stream: BrowserProtocolStream, message: RendezvousMessage) {
  const payload = encodeMessage(message, rendezvousMessageCodec());
  const frame = mergeUint8Arrays(encodeUnsignedVarint(payload.length), payload);
  const sendOk = stream.send(frame);
  if (!sendOk) {
    await stream.onDrain();
  }
}

async function readDelimitedRendezvousMessage(stream: AsyncIterable<StreamChunk>) {
  const iterator = stream[Symbol.asyncIterator]();
  let buffered = new Uint8Array(0);

  while (true) {
    const header = readUnsignedVarint(buffered);
    if (header != null && buffered.length >= header.length + header.value) {
      return decodeMessage(buffered.slice(header.length, header.length + header.value), rendezvousMessageCodec());
    }

    const next = await iterator.next();
    if (next.done) {
      throw new Error("unexpected end of rendezvous stream");
    }
    buffered = mergeUint8Arrays(buffered, chunkToUint8Array(next.value));
  }
}

export async function buildRegistrationFromSignedPeerRecord(params: {
  registration: RendezvousRegisterMessage;
  selfPeerId: string;
  sourcePeerId: string;
}) {
  const signedPeerRecord = params.registration.signedPeerRecord;
  if (signedPeerRecord == null || signedPeerRecord.byteLength === 0) {
    return null;
  }

  const envelope = await RecordEnvelope.openAndCertify(signedPeerRecord, PeerRecord.DOMAIN);
  const peerRecord = PeerRecord.createFromProtobuf(envelope.payload);
  const peerId = peerRecord.peerId.toString();
  if (peerId === params.selfPeerId) {
    return null;
  }

  const ttlSeconds = params.registration.ttl == null ? 0 : Number(params.registration.ttl);
  const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 0;
  const now = Date.now();
  return {
    peerId,
    sourcePeerId: params.sourcePeerId,
    discoveredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    multiaddrs: peerRecord.multiaddrs.map((value) => value.toString()),
  } satisfies RendezvousPeerRegistration;
}

class GomtmRendezvousDiscovery extends EventTarget {
  readonly #components: RendezvousDiscoveryComponents;
  readonly #init: Required<RendezvousDiscoveryInit>;
  readonly #cookies = new Map<string, Uint8Array>();
  #fullReconcileTimer: ReturnType<typeof setTimeout> | null = null;
  #incrementalPollTimer: ReturnType<typeof setTimeout> | null = null;
  #readyPromise: Promise<void> | null = null;
  #resolveReady: (() => void) | null = null;
  #rejectReady: ((error: unknown) => void) | null = null;
  #registrations = new Map<string, RendezvousPeerRegistration>();
  #running = false;
  #startupSyncStarted = false;

  constructor(components: RendezvousDiscoveryComponents, init: RendezvousDiscoveryInit) {
    super();
    this.#components = components;
    this.#init = {
      // cookie 增量发现只负责新增/更新，删除仍要靠周期性全量对账收口。
      fullReconcileIntervalMs: init.fullReconcileIntervalMs ?? 15_000,
      incrementalPollIntervalMs: init.incrementalPollIntervalMs ?? 5_000,
      namespace: init.namespace ?? GOMTM_RENDEZVOUS_NAMESPACE,
      points: init.points,
    };
  }

  get [peerDiscoverySymbol]() {
    return this;
  }

  async start() {
    if (this.#running) {
      return;
    }

    this.#running = true;
    this.#startupSyncStarted = false;
    this.#ensureReadyDeferred();
  }

  async afterStart() {
    if (!this.#running) {
      return;
    }
    this.#ensureReadyDeferred();
    if (this.#startupSyncStarted) {
      await this.#readyPromise;
      return;
    }

    this.#startupSyncStarted = true;
    try {
      await this.#refreshSnapshot({ resetCookie: true });
      this.#scheduleIncrementalPoll();
      this.#scheduleFullReconcile();
      this.#resolveReady?.();
      this.#clearReadyCallbacks();
    } catch (error) {
      this.#running = false;
      this.#startupSyncStarted = false;
      this.#rejectReady?.(error);
      this.#resetReadyDeferred();
      throw error;
    }
  }

  async stop() {
    this.#running = false;
    this.#startupSyncStarted = false;
    if (this.#incrementalPollTimer != null) {
      clearTimeout(this.#incrementalPollTimer);
      this.#incrementalPollTimer = null;
    }
    if (this.#fullReconcileTimer != null) {
      clearTimeout(this.#fullReconcileTimer);
      this.#fullReconcileTimer = null;
    }
    this.#resolveReady?.();
    this.#resetReadyDeferred();
  }

  async awaitReady() {
    await this.#readyPromise;
  }

  #ensureReadyDeferred() {
    if (this.#readyPromise != null) {
      return;
    }
    this.#readyPromise = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
  }

  #clearReadyCallbacks() {
    this.#resolveReady = null;
    this.#rejectReady = null;
  }

  #resetReadyDeferred() {
    this.#readyPromise = null;
    this.#clearReadyCallbacks();
  }

  async listPeerCandidates() {
    this.#pruneExpiredRegistrations(this.#registrations);
    return [...this.#registrations.values()]
      .map((registration) => buildPeerCandidateFromRendezvousRegistration(registration))
      .sort((left, right) => left.peerId.localeCompare(right.peerId));
  }

  async #refreshSnapshot(options?: { resetCookie?: boolean }) {
    const resetCookie = options?.resetCookie === true;
    const previous = this.#registrations;
    const next = resetCookie ? new Map<string, RendezvousPeerRegistration>() : new Map(previous);
    this.#pruneExpiredRegistrations(next);

    for (const point of this.#init.points) {
      const cookie = resetCookie ? undefined : this.#cookies.get(point);
      const result = await this.#discoverPoint(point, cookie);
      this.#cookies.set(point, result.cookie ?? new Uint8Array(0));
      for (const update of result.registrations) {
        const registration = update.registration;
        const previousRegistration = next.get(registration.peerId);
        next.set(registration.peerId, registration);
        if (previousRegistration == null) {
          this.#dispatchPeerDiscovery(registration);
        }
        await this.#components.peerStore.consumePeerRecord(update.signedPeerRecord, {
          expectedPeer: peerIdFromString(update.registration.peerId),
        });
      }
    }

    this.#registrations = next;
  }

  #dispatchPeerDiscovery(registration: RendezvousPeerRegistration) {
    this.dispatchEvent(
      new CustomEvent("peer", {
        detail: {
          id: peerIdFromString(registration.peerId),
          multiaddrs: registration.multiaddrs.map((value) => multiaddr(value)),
        },
      }),
    );
  }

  #pruneExpiredRegistrations(registrations: Map<string, RendezvousPeerRegistration>) {
    let changed = false;
    const now = Date.now();
    for (const [peerId, registration] of registrations) {
      const expiresAtMs = Date.parse(registration.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs > now) {
        continue;
      }
      registrations.delete(peerId);
      changed = true;
    }
    return changed;
  }

  #scheduleIncrementalPoll() {
    if (!this.#running) {
      return;
    }
    this.#incrementalPollTimer = setTimeout(() => {
      void this.#refreshSnapshot()
        .catch(() => {
          // 增量发现失败时保留当前快照，下个周期继续拉取。
        })
        .finally(() => {
          this.#scheduleIncrementalPoll();
        });
    }, this.#init.incrementalPollIntervalMs);
  }

  #scheduleFullReconcile() {
    if (!this.#running) {
      return;
    }
    this.#fullReconcileTimer = setTimeout(() => {
      void this.#refreshSnapshot({ resetCookie: true })
        .catch(() => {
          // 全量对账失败时保留当前快照，下个周期继续尝试。
        })
        .finally(() => {
          this.#scheduleFullReconcile();
        });
    }, this.#init.fullReconcileIntervalMs);
  }

  async #discoverPoint(point: string, cookie?: Uint8Array) {
    const sourcePeerId = extractPeerIdFromMultiaddrString(point);
    const stream = await this.#components.connectionManager.openStream(multiaddr(point), RENDEZVOUS_PROTOCOL, {
      priority: 75,
      runOnLimitedConnection: true,
    });

    try {
      await writeDelimitedRendezvousMessage(stream, {
        type: RendezvousMessageType.DISCOVER,
        discover: {
          ns: this.#init.namespace,
          limit: 100,
          cookie,
        },
      });

      const response = await readDelimitedRendezvousMessage(stream);
      const discoverResponse = response.discoverResponse;
      if (discoverResponse == null) {
        throw new Error("rendezvous point returned no discover response payload");
      }
      if ((discoverResponse.status ?? RendezvousResponseStatus.OK) !== RendezvousResponseStatus.OK) {
        throw new Error(discoverResponse.statusText ?? "rendezvous discover failed");
      }

      const registrations = (
        await Promise.all(
          (discoverResponse.registrations ?? []).map(async (registration) => {
            const nextRegistration = await buildRegistrationFromSignedPeerRecord({
              registration,
              selfPeerId: this.#components.peerId.toString(),
              sourcePeerId,
            });
            if (nextRegistration == null) {
              return null;
            }
            return {
              registration: nextRegistration,
              signedPeerRecord: registration.signedPeerRecord ?? new Uint8Array(0),
            } satisfies DiscoveredRegistrationUpdate;
          }),
        )
      ).filter((registration): registration is DiscoveredRegistrationUpdate => registration != null);

      console.log(
        `[P2P][rendezvous] discover ${JSON.stringify({
          cookieLength: discoverResponse.cookie?.byteLength ?? 0,
          point,
          registrations: registrations.map((item) => ({
            peerId: item.registration.peerId,
            multiaddrs: item.registration.multiaddrs,
          })),
        })}`,
      );

      return {
        cookie: discoverResponse.cookie,
        registrations,
      };
    } finally {
      await stream.close();
    }
  }
}

export function gomtmRendezvousDiscovery(init: RendezvousDiscoveryInit) {
  return (components: RendezvousDiscoveryComponents): BrowserRendezvousDiscoveryService => {
    return new GomtmRendezvousDiscovery(components, init) as BrowserRendezvousDiscoveryService;
  };
}
