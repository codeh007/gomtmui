import { P2PPeerRemotePageView } from "./p2p-peer-remote-page-view";

export default async function P2PPeerRemotePage({ params }: { params: Promise<{ peer_id: string }> }) {
  const { peer_id } = await params;

  return <P2PPeerRemotePageView peerId={peer_id} />;
}
