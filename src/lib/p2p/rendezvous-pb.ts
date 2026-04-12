import type { Codec } from "protons-runtime";
import { enumeration, message } from "protons-runtime";

export enum RendezvousMessageType {
  REGISTER = "REGISTER",
  REGISTER_RESPONSE = "REGISTER_RESPONSE",
  UNREGISTER = "UNREGISTER",
  DISCOVER = "DISCOVER",
  DISCOVER_RESPONSE = "DISCOVER_RESPONSE",
}

enum RendezvousMessageTypeValue {
  REGISTER = 0,
  REGISTER_RESPONSE = 1,
  UNREGISTER = 2,
  DISCOVER = 3,
  DISCOVER_RESPONSE = 4,
}

export enum RendezvousResponseStatus {
  OK = "OK",
  E_INVALID_NAMESPACE = "E_INVALID_NAMESPACE",
  E_INVALID_SIGNED_PEER_RECORD = "E_INVALID_SIGNED_PEER_RECORD",
  E_INVALID_TTL = "E_INVALID_TTL",
  E_INVALID_COOKIE = "E_INVALID_COOKIE",
  E_NOT_AUTHORIZED = "E_NOT_AUTHORIZED",
  E_INTERNAL_ERROR = "E_INTERNAL_ERROR",
  E_UNAVAILABLE = "E_UNAVAILABLE",
}

enum RendezvousResponseStatusValue {
  OK = 0,
  E_INVALID_NAMESPACE = 100,
  E_INVALID_SIGNED_PEER_RECORD = 101,
  E_INVALID_TTL = 102,
  E_INVALID_COOKIE = 103,
  E_NOT_AUTHORIZED = 200,
  E_INTERNAL_ERROR = 300,
  E_UNAVAILABLE = 400,
}

export type RendezvousRegisterMessage = {
  ns?: string;
  signedPeerRecord?: Uint8Array;
  ttl?: number;
};

export type RendezvousRegisterResponseMessage = {
  status?: RendezvousResponseStatus;
  statusText?: string;
  ttl?: number;
};

export type RendezvousDiscoverMessage = {
  ns?: string;
  limit?: number;
  cookie?: Uint8Array;
};

export type RendezvousUnregisterMessage = {
  ns?: string;
};

export type RendezvousDiscoverResponseMessage = {
  registrations?: RendezvousRegisterMessage[];
  cookie?: Uint8Array;
  status?: RendezvousResponseStatus;
  statusText?: string;
};

export type RendezvousMessage = {
  type?: RendezvousMessageType;
  register?: RendezvousRegisterMessage;
  registerResponse?: RendezvousRegisterResponseMessage;
  unregister?: RendezvousUnregisterMessage;
  discover?: RendezvousDiscoverMessage;
  discoverResponse?: RendezvousDiscoverResponseMessage;
};

let rendezvousRegisterCodec: Codec<RendezvousRegisterMessage> | undefined;
export function rendezvousRegisterMessageCodec(): Codec<RendezvousRegisterMessage> {
  if (rendezvousRegisterCodec == null) {
    rendezvousRegisterCodec = message<RendezvousRegisterMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        if (obj.ns != null) {
          writer.uint32(10);
          writer.string(obj.ns);
        }
        if (obj.signedPeerRecord != null) {
          writer.uint32(18);
          writer.bytes(obj.signedPeerRecord);
        }
        if (obj.ttl != null) {
          writer.uint32(24);
          writer.uint64Number(obj.ttl);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousRegisterMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.ns = reader.string();
              break;
            case 2:
              obj.signedPeerRecord = reader.bytes();
              break;
            case 3:
              obj.ttl = Number(reader.uint64());
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousRegisterCodec;
}

let rendezvousRegisterResponseCodec: Codec<RendezvousRegisterResponseMessage> | undefined;
export function rendezvousRegisterResponseMessageCodec(): Codec<RendezvousRegisterResponseMessage> {
  if (rendezvousRegisterResponseCodec == null) {
    rendezvousRegisterResponseCodec = message<RendezvousRegisterResponseMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        if (obj.status != null) {
          writer.uint32(8);
          enumeration<RendezvousResponseStatus>(RendezvousResponseStatusValue).encode(obj.status, writer);
        }
        if (obj.statusText != null) {
          writer.uint32(18);
          writer.string(obj.statusText);
        }
        if (obj.ttl != null) {
          writer.uint32(24);
          writer.uint64Number(obj.ttl);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousRegisterResponseMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.status = enumeration<RendezvousResponseStatus>(RendezvousResponseStatusValue).decode(reader);
              break;
            case 2:
              obj.statusText = reader.string();
              break;
            case 3:
              obj.ttl = Number(reader.uint64());
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousRegisterResponseCodec;
}

let rendezvousDiscoverCodec: Codec<RendezvousDiscoverMessage> | undefined;
export function rendezvousDiscoverMessageCodec(): Codec<RendezvousDiscoverMessage> {
  if (rendezvousDiscoverCodec == null) {
    rendezvousDiscoverCodec = message<RendezvousDiscoverMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        if (obj.ns != null) {
          writer.uint32(10);
          writer.string(obj.ns);
        }
        if (obj.limit != null) {
          writer.uint32(16);
          writer.uint64Number(obj.limit);
        }
        if (obj.cookie != null) {
          writer.uint32(26);
          writer.bytes(obj.cookie);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousDiscoverMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.ns = reader.string();
              break;
            case 2:
              obj.limit = Number(reader.uint64());
              break;
            case 3:
              obj.cookie = reader.bytes();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousDiscoverCodec;
}

let rendezvousUnregisterCodec: Codec<RendezvousUnregisterMessage> | undefined;
export function rendezvousUnregisterMessageCodec(): Codec<RendezvousUnregisterMessage> {
  if (rendezvousUnregisterCodec == null) {
    rendezvousUnregisterCodec = message<RendezvousUnregisterMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        if (obj.ns != null) {
          writer.uint32(10);
          writer.string(obj.ns);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousUnregisterMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.ns = reader.string();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousUnregisterCodec;
}

let rendezvousDiscoverResponseCodec: Codec<RendezvousDiscoverResponseMessage> | undefined;
export function rendezvousDiscoverResponseMessageCodec(): Codec<RendezvousDiscoverResponseMessage> {
  if (rendezvousDiscoverResponseCodec == null) {
    rendezvousDiscoverResponseCodec = message<RendezvousDiscoverResponseMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        for (const registration of obj.registrations ?? []) {
          writer.uint32(10);
          rendezvousRegisterMessageCodec().encode(registration, writer);
        }
        if (obj.cookie != null) {
          writer.uint32(18);
          writer.bytes(obj.cookie);
        }
        if (obj.status != null) {
          writer.uint32(24);
          enumeration<RendezvousResponseStatus>(RendezvousResponseStatusValue).encode(obj.status, writer);
        }
        if (obj.statusText != null) {
          writer.uint32(34);
          writer.string(obj.statusText);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousDiscoverResponseMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.registrations = obj.registrations ?? [];
              obj.registrations.push(rendezvousRegisterMessageCodec().decode(reader, reader.uint32()));
              break;
            case 2:
              obj.cookie = reader.bytes();
              break;
            case 3:
              obj.status = enumeration<RendezvousResponseStatus>(RendezvousResponseStatusValue).decode(reader);
              break;
            case 4:
              obj.statusText = reader.string();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousDiscoverResponseCodec;
}

let rendezvousMessageCodecValue: Codec<RendezvousMessage> | undefined;
export function rendezvousMessageCodec(): Codec<RendezvousMessage> {
  if (rendezvousMessageCodecValue == null) {
    rendezvousMessageCodecValue = message<RendezvousMessage>(
      (obj, writer, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          writer.fork();
        }
        if (obj.type != null) {
          writer.uint32(8);
          enumeration<RendezvousMessageType>(RendezvousMessageTypeValue).encode(obj.type, writer);
        }
        if (obj.register != null) {
          writer.uint32(18);
          rendezvousRegisterMessageCodec().encode(obj.register, writer);
        }
        if (obj.registerResponse != null) {
          writer.uint32(26);
          rendezvousRegisterResponseMessageCodec().encode(obj.registerResponse, writer);
        }
        if (obj.unregister != null) {
          writer.uint32(34);
          rendezvousUnregisterMessageCodec().encode(obj.unregister, writer);
        }
        if (obj.discover != null) {
          writer.uint32(42);
          rendezvousDiscoverMessageCodec().encode(obj.discover, writer);
        }
        if (obj.discoverResponse != null) {
          writer.uint32(50);
          rendezvousDiscoverResponseMessageCodec().encode(obj.discoverResponse, writer);
        }
        if (opts.lengthDelimited !== false) {
          writer.ldelim();
        }
      },
      (reader, length) => {
        const obj: RendezvousMessage = {};
        const end = length == null ? reader.len : reader.pos + length;
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              obj.type = enumeration<RendezvousMessageType>(RendezvousMessageTypeValue).decode(reader);
              break;
            case 2:
              obj.register = rendezvousRegisterMessageCodec().decode(reader, reader.uint32());
              break;
            case 3:
              obj.registerResponse = rendezvousRegisterResponseMessageCodec().decode(reader, reader.uint32());
              break;
            case 4:
              obj.unregister = rendezvousUnregisterMessageCodec().decode(reader, reader.uint32());
              break;
            case 5:
              obj.discover = rendezvousDiscoverMessageCodec().decode(reader, reader.uint32());
              break;
            case 6:
              obj.discoverResponse = rendezvousDiscoverResponseMessageCodec().decode(reader, reader.uint32());
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return obj;
      },
    );
  }
  return rendezvousMessageCodecValue;
}
