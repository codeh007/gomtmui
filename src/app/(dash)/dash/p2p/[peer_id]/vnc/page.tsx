import { P2PVncPageView } from "./p2p-vnc-page-view";

export default async function P2PVncPage(props: { params: Promise<{ peer_id: string }> }) {
  const params = await props.params;
  return <P2PVncPageView peerId={params.peer_id} />;
}
