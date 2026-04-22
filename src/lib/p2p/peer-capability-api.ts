import type { BrowserNodeLike } from "./libp2p-stream";
import {
  parsePeerCapabilityDescriptors,
  parsePeerCapabilityTruthDocument,
  type PeerCapabilityDescriptor,
  type PeerCapabilityTruth,
} from "./discovery-contracts";
import { requestPeerHTTP } from "./peer-http-client";

async function requestPeerCapabilityPayload(params: {
  address: string;
  node: BrowserNodeLike;
}) {
  return await requestPeerHTTP({
    address: params.address,
    method: "GET",
    node: params.node,
    path: "/api/capabilities",
  });
}

export async function requestPeerCapabilities(params: {
  address: string;
  node: BrowserNodeLike;
  peerId?: string;
}): Promise<PeerCapabilityDescriptor[]> {
  return parsePeerCapabilityDescriptors(await requestPeerCapabilityPayload(params));
}

export async function requestPeerCapabilityTruth(params: {
  address: string;
  node: BrowserNodeLike;
  peerId?: string;
}): Promise<PeerCapabilityTruth> {
  const payload = await requestPeerCapabilityPayload(params);
  const truth = parsePeerCapabilityTruthDocument(payload);
  if (truth == null) {
    throw new Error("peer returned no capability truth");
  }
  return truth;
}
