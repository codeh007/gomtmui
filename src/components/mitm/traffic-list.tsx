import { Wifi } from "lucide-react";
import type { TrafficLog } from "mtmsdk/types/contracts";
import { ItemGroup } from "mtxuilib/ui/item";
import { LogLevelBadge, UnifiedLogItem } from "@/components/common/log-list-item";
import { MethodBadge } from "./traffic-badges";

interface TrafficListProps {
  logs: TrafficLog[];
  selectedLogId?: string;
  onSelectLog: (log: TrafficLog) => void;
}

export function TrafficList({ logs, selectedLogId, onSelectLog }: TrafficListProps) {
  if (logs.length === 0) {
    return (
      <div className="flex-1 overflow-auto bg-white border-r p-8 flex items-center justify-center">
        <div className="text-center text-muted-foreground italic text-sm">暂无流量数据</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white border-r">
      <ItemGroup className="rounded-none border-x-0 border-t-0 p-0">
        {logs.map((log) => (
          <UnifiedLogItem
            key={log.id}
            onClick={() => onSelectLog(log)}
            selected={selectedLogId === log.id}
            timestamp={log.timestamp}
            headerLeft={[
              <MethodBadge key="method" method={log.method} />,
              <LogLevelBadge key="status" level={log.status} />,
            ]}
            content={
              <span className="font-mono text-xs text-muted-foreground ml-1 break-all flex items-center gap-1">
                <Wifi className="w-3 h-3 text-slate-400 shrink-0" /> {log.host}
                <span className="text-foreground ml-1 font-sans">{log.path}</span>
              </span>
            }
            footer={
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-slate-500">{log.size}</span>
                <span className="font-mono text-[10px] text-blue-500/70">{log.duration}</span>
                {log.client_ip && <span className="font-mono text-[10px] opacity-70">IP: {log.client_ip}</span>}
              </div>
            }
          />
        ))}
      </ItemGroup>
    </div>
  );
}
