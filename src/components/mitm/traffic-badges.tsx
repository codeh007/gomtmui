import { Circle } from "lucide-react";
import { cn } from "mtxuilib/lib/utils";
import { Badge } from "mtxuilib/ui/badge";

export function StatusDot({ status }: { status: string }) {
  const color = status === "online" ? "text-green-500" : status === "busy" ? "text-yellow-500" : "text-gray-400";
  return <Circle className={cn("w-2.5 h-2.5 fill-current", color)} />;
}

export function MethodBadge({ method }: { method: string }) {
  const variants: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200",
    POST: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
    PUT: "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200",
    DELETE: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
  };
  return (
    <Badge variant="outline" className={cn("font-mono font-bold", variants[method] || "bg-gray-100 text-gray-700")}>
      {method}
    </Badge>
  );
}

export function StatusCode({ code }: { code: number }) {
  let color = "text-gray-500";
  if (code >= 200 && code < 300) color = "text-green-600";
  else if (code >= 300 && code < 400) color = "text-blue-600";
  else if (code >= 400 && code < 500) color = "text-orange-600";
  else if (code >= 500) color = "text-red-600";

  return <span className={cn("font-mono font-medium", color)}>{code}</span>;
}
