import { LinkIcon, RefreshCw, Search, Settings, Trash2, WifiOff } from "lucide-react";
import type { ServerInstanceGetReturns } from "mtmsdk/types/contracts";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { Input } from "mtxuilib/ui/input";
import { ConnectView } from "@/components/server-instance/mitm/connect-view";
import { TrafficDbConfigForm } from "@/components/server-instance/mitm/traffic-db-config";

interface MitmToolbarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  isLive: boolean;
  onToggleLive: () => void;
  onClear: () => Promise<void>;
  configOpen: boolean;
  onConfigOpenChange: (open: boolean) => void;
  resource: ServerInstanceGetReturns | null;
  endpoint: string;
}

export function MitmToolbar({
  searchTerm,
  onSearchTermChange,
  isLive,
  onToggleLive,
  onClear,
  configOpen,
  onConfigOpenChange,
  resource,
  endpoint,
}: MitmToolbarProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <div className="relative hidden lg:block">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索主机或路径..."
          className="pl-9 w-[200px] h-8 text-sm bg-white"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>

      <Button
        variant={isLive ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1 text-xs px-2 sm:px-3"
        onClick={onToggleLive}
        title={isLive ? "停止实时更新" : "启动实时更新"}
      >
        {isLive ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">实时</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">暂停</span>
          </>
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 sm:px-3"
        onClick={() => void onClear()}
        title="清空流量记录"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">清空</span>
      </Button>

      <div className="w-px h-4 bg-gray-200 mx-1 hidden sm:block" />

      <Dialog open={configOpen} onOpenChange={onConfigOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs px-2 sm:px-3" title="数据库配置">
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">配置</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] p-0 border-0 bg-transparent shadow-none">
          <TrafficDbConfigForm resource={resource} />
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="default"
            className="gap-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-700 px-2 sm:px-3"
            title="连接设备"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">连接</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>设备连接</DialogTitle>
            <DialogDescription>将此订阅地址导入您的代理客户端，即可开始分析流量。</DialogDescription>
          </DialogHeader>
          <ConnectView endpoint={endpoint} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
