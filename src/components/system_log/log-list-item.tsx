import { Badge } from "mtxuilib/ui/badge";
import { LogJsonDetails, LogLevelBadge, UnifiedLogItem } from "@/components/common/log-list-item";
import { TunnelSetupFailedMetaSchema } from "./schemas";

interface BaseLog {
  id: string;
  created_at: string | null;
}

interface SysLog extends BaseLog {
  text: string;
  level: "error" | "warn" | "info";
  module: string;
  event_type: string;
  meta: any;
  resource_type?: string | null;
  resource_id?: string | null;
  user_id?: string | null;
}

interface UserLog extends BaseLog {
  level: string | null;
  event_type: string | null;
  content: string | null;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  meta: any;
}

interface LogListItemProps {
  log: SysLog | UserLog;
  type: "system" | "user";
}

export function LogListItem({ log, type }: LogListItemProps) {
  const isSys = type === "system";
  const sysLog = isSys ? (log as SysLog) : null;
  const userLog = !isSys ? (log as UserLog) : null;

  const level = isSys ? sysLog?.level : userLog?.level;
  const eventType = isSys ? sysLog?.event_type : userLog?.event_type;
  const content = isSys ? sysLog?.text : userLog?.content;
  const resourceType = isSys ? sysLog?.resource_type : userLog?.resource_type;
  const resourceId = isSys ? sysLog?.resource_id : userLog?.resource_id;
  const moduleName = isSys ? sysLog?.module : null;

  const hasMeta = log.meta && Object.keys(log.meta).length > 0;

  // Optional: runtime validation warning for development
  if (hasMeta) {
    if (log.event_type === "tunnel_setup_failed") {
      const result = TunnelSetupFailedMetaSchema.safeParse(log.meta);
      if (!result.success) {
        console.warn(`[LogListItem] Invalid meta for ${log.event_type}:`, result.error);
      }
    }
  }

  return (
    <UnifiedLogItem
      timestamp={log.created_at}
      content={content}
      headerLeft={[
        <LogLevelBadge key="level" level={level} />,
        moduleName ? (
          <Badge
            key="module"
            variant="outline"
            className="text-[10px] px-1.5 h-4 font-normal text-muted-foreground mr-2"
          >
            {moduleName}
          </Badge>
        ) : null,
        <span key="type" className="font-mono text-[10px] text-primary/70 bg-primary/5 px-1 py-0.5 rounded">
          {eventType || "unknown"}
        </span>,
      ]}
      footer={
        resourceType || resourceId ? (
          <>
            {resourceType && <span className="font-medium">{resourceType}</span>}
            {resourceId && <span className="font-mono opacity-70">#{resourceId.slice(0, 8)}</span>}
          </>
        ) : null
      }
    >
      <LogJsonDetails meta={log.meta} />
    </UnifiedLogItem>
  );
}
