import { Check, Copy, Terminal, Wifi } from "lucide-react";
import type { TrafficLog } from "mtmsdk/types/contracts";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "mtxuilib/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "mtxuilib/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "./traffic-badges";

interface TrafficDetailsProps {
  log: TrafficLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrafficDetails({ log, open, onOpenChange }: TrafficDetailsProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  if (!log) return null;

  const fullUrl = `${log.scheme}://${log.host}${log.path}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    toast.success("URL 已复制");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCurl = () => {
    const headers = log.request_headers
      ? Object.entries(log.request_headers)
          .map(([k, v]) => `-H "${k}: ${Array.isArray(v) ? v.join(", ") : v}"`)
          .join(" ")
      : "";
    const body = log.request_body ? `-d '${log.request_body}'` : "";
    const curl = `curl -X ${log.method} "${fullUrl}" ${headers} ${body}`;
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    toast.success("cURL 已复制");
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[800px] flex flex-col p-0 gap-0" side="right">
        <SheetHeader className="px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <MethodBadge method={log.method} />
              <span className="text-xl font-semibold text-foreground">
                {log.status} {log.status >= 200 && log.status < 300 ? "OK" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3"
                onClick={handleCopyUrl}
              >
                {copiedUrl ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                <span className="hidden sm:inline">复制 URL</span>
                <span className="sm:hidden">URL</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3"
                onClick={handleCopyCurl}
              >
                {copiedCurl ? <Check className="w-3 h-3 text-green-600" /> : <Terminal className="w-3 h-3" />}
                <span className="hidden sm:inline">复制为 cURL</span>
                <span className="sm:hidden">cURL</span>
              </Button>
            </div>
          </div>
          <SheetTitle className="break-all text-sm font-normal font-mono text-blue-600 bg-blue-50/50 p-2 rounded border border-blue-100/50">
            {fullUrl}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-4 text-[11px] font-mono mt-3 text-slate-500">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3" /> {log.host}
            </span>
            <span>•</span>
            <span>{log.size}</span>
            <span>•</span>
            <span>{log.duration}</span>
            <span>•</span>
            <span>{new Date(log.timestamp).toLocaleString()}</span>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="request" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b bg-white">
            <TabsList className="h-10 p-0 bg-transparent flex gap-2 sm:gap-6 overflow-x-auto overflow-y-hidden no-scrollbar">
              <TabsTrigger
                value="request"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:shadow-none px-2 bg-transparent text-[10px] sm:text-xs whitespace-nowrap"
              >
                <span className="hidden sm:inline">请求 (Request)</span>
                <span className="sm:hidden">请求</span>
              </TabsTrigger>
              <TabsTrigger
                value="response"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:shadow-none px-2 bg-transparent text-[10px] sm:text-xs whitespace-nowrap"
              >
                <span className="hidden sm:inline">响应 (Response)</span>
                <span className="sm:hidden">响应</span>
              </TabsTrigger>
              <TabsTrigger
                value="info"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:shadow-none px-2 bg-transparent text-[10px] sm:text-xs whitespace-nowrap"
              >
                <span className="hidden sm:inline">计时与信息</span>
                <span className="sm:hidden">信息</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="request" className="flex-1 overflow-hidden m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                    请求头 (Headers){" "}
                    <Badge variant="secondary" className="ml-2 text-[10px] h-5">
                      {log.request_headers ? Object.keys(log.request_headers).length : 0}
                    </Badge>
                  </h4>
                  <div className="bg-muted/30 rounded-md border p-3 font-mono text-xs space-y-1.5 overflow-x-auto">
                    {log.request_headers && Object.keys(log.request_headers).length > 0 ? (
                      Object.entries(log.request_headers).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
                          <span className="text-muted-foreground break-all">{key}:</span>
                          <span className="text-foreground break-all">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground italic">无请求头</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">请求体 (Body)</h4>
                  {log.request_body ? (
                    <div className="bg-muted/30 rounded-md border p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {/* Try to pretty print if JSON, otherwise string */}
                      {tryFormatJson(log.request_body)}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-md border p-4 font-mono text-xs text-muted-foreground italic text-center py-8">
                      无请求体内容
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="response" className="flex-1 overflow-hidden m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                    响应头 (Headers){" "}
                    <Badge variant="secondary" className="ml-2 text-[10px] h-5">
                      {log.response_headers ? Object.keys(log.response_headers).length : 0}
                    </Badge>
                  </h4>
                  <div className="bg-muted/30 rounded-md border p-3 font-mono text-xs space-y-1.5 overflow-x-auto">
                    {log.response_headers && Object.keys(log.response_headers).length > 0 ? (
                      Object.entries(log.response_headers).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
                          <span className="text-muted-foreground break-all">{key}:</span>
                          <span className="text-foreground break-all">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground italic">无响应头</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">响应体 (Body)</h4>
                  {log.response_body ? (
                    <div className="bg-slate-950 text-slate-50 rounded-md border border-slate-800 p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {tryFormatJson(log.response_body)}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-md border p-4 font-mono text-xs text-muted-foreground italic text-center py-8">
                      无响应体内容
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function tryFormatJson(str: string): string {
  try {
    const obj = JSON.parse(str);
    return JSON.stringify(obj, null, 2);
  } catch (_e) {
    return str;
  }
}
