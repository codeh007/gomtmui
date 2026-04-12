import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import type { ServerInstanceStatusDto } from "@/components/server-instance/status-contract";
import { formatServerOptionLabel } from "./shared";

interface MitmInstanceSelectProps {
  instances: ServerInstanceStatusDto[];
  selectedServerId: string;
  onSelectServer: (value: string) => void;
  useInternal: boolean;
}

export function MitmInstanceSelect({
  instances,
  selectedServerId,
  onSelectServer,
  useInternal,
}: MitmInstanceSelectProps) {
  return (
    <div className="flex items-center gap-2 min-w-0 shrink">
      <h1 className="text-sm sm:text-lg font-semibold flex items-center gap-1 sm:gap-2 truncate">
        <span className="hidden sm:inline">流量监控</span>
        <span className="sm:hidden">流量</span>
        {useInternal && (
          <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1 sm:px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap">
            内部
          </span>
        )}
      </h1>
      <div className="hidden md:block min-w-[220px]">
        <Select value={selectedServerId} onValueChange={onSelectServer}>
          <SelectTrigger className="h-8 bg-white text-xs">
            <SelectValue placeholder="选择服务实例" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id ?? ""}>
                {formatServerOptionLabel(instance)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
