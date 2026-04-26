"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Cpu,
  DollarSign,
  GitBranch,
  Hash,
  MessageSquareText,
  Wrench,
} from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "mtxuilib/ui/dialog";
import { ScrollArea } from "mtxuilib/ui/scroll-area";
import { Separator } from "mtxuilib/ui/separator";
import { useEffect, useMemo, useState } from "react";

import { api as hermesApi } from "@/lib/hermes/api";
import type { SessionInfo, SessionMessage } from "@/lib/hermes/types";
import { timeAgo } from "@/lib/hermes/utils";

function formatNumber(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function formatMoney(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return "-";
  return new Date(value * 1000).toLocaleString();
}

function ToolCallCard({
  toolCall,
}: {
  toolCall: { function: { arguments: string; name: string }; id: string };
}) {
  const [open, setOpen] = useState(false);

  let formattedArguments = toolCall.function.arguments;
  try {
    formattedArguments = JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2);
  } catch {
    // Keep raw arguments when they are not JSON.
  }

  return (
    <div className="overflow-hidden rounded-md border border-warning/30 bg-warning/5">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warning hover:bg-warning/10"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        <span className="font-medium">{toolCall.function.name}</span>
        <span className="ml-auto text-warning/70">{toolCall.id}</span>
      </button>
      {open ? (
        <pre className="overflow-x-auto border-t border-warning/20 px-3 py-2 text-xs text-warning/80 whitespace-pre-wrap">
          {formattedArguments}
        </pre>
      ) : null}
    </div>
  );
}

function MessageCard({ message }: { message: SessionMessage }) {
  const roleTone: Record<SessionMessage["role"], string> = {
    assistant: "bg-emerald-500/10 border-emerald-500/20",
    system: "bg-muted border-border",
    tool: "bg-warning/10 border-warning/20",
    user: "bg-primary/10 border-primary/20",
  };

  const label = message.tool_name ? `tool:${message.tool_name}` : message.role;

  return (
    <div className={`rounded-lg border p-3 ${roleTone[message.role]}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{label}</Badge>
        {message.timestamp ? <span>{timeAgo(message.timestamp)}</span> : null}
        {message.finish_reason ? <Badge variant="secondary">{message.finish_reason}</Badge> : null}
        {typeof message.token_count === "number" ? <span>{formatNumber(message.token_count)} tokens</span> : null}
      </div>
      {message.content ? (
        message.role === "system" ? (
          <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )
      ) : null}
      {message.reasoning_content ? (
        <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">Reasoning</div>
          {message.reasoning_content}
        </div>
      ) : null}
      {message.tool_calls?.length ? (
        <div className="mt-3 space-y-2">
          {message.tool_calls.map((toolCall) => (
            <ToolCallCard key={toolCall.id} toolCall={toolCall} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="break-all text-sm">{value || "-"}</div>
    </div>
  );
}

export function SessionDetailView(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
}) {
  const [detail, setDetail] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open || !props.sessionId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      hermesApi.getSessions(200, 0).then((response) => {
        const match = response.sessions.find((session) => session.id === props.sessionId);
        if (match) {
          return match;
        }
        throw new Error(`Session ${props.sessionId} not found in current listing`);
      }),
      hermesApi.getSessionMessages(props.sessionId),
    ])
      .then(([session, messageResponse]) => {
        if (cancelled) return;
        setDetail({
          ...session,
          last_active: session.last_active ?? session.started_at,
          is_active: session.is_active ?? false,
          preview: session.preview ?? null,
        });
        setMessages(messageResponse.messages);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.open, props.sessionId]);

  const title = useMemo(() => {
    if (!detail) return props.sessionId || "Session";
    return detail.title || detail.preview || detail.id;
  }, [detail, props.sessionId]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-left text-lg">
            <MessageSquareText className="h-5 w-5 text-muted-foreground" />
            <span className="truncate">{title}</span>
            {detail?.is_active ? <Badge>live</Badge> : null}
            {detail?.end_reason ? <Badge variant="secondary">{detail.end_reason}</Badge> : null}
          </DialogTitle>
          <DialogDescription className="text-left">
            {detail ? detail.id : props.sessionId || "Loading session..."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <ScrollArea className="max-h-[80vh] border-b lg:border-b-0 lg:border-r">
            <div className="space-y-4 p-6">
              {loading ? <div className="text-sm text-muted-foreground">Loading session detail...</div> : null}
              {error ? <div className="text-sm text-destructive">{error}</div> : null}
              {detail ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                        Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <MetaItem label="Started" value={formatTimestamp(detail.started_at)} />
                      <MetaItem label="Last Active" value={formatTimestamp(detail.last_active)} />
                      <MetaItem label="Ended" value={formatTimestamp(detail.ended_at)} />
                      <MetaItem label="Source" value={detail.source || "-"} />
                      <MetaItem label="Model" value={detail.model || "-"} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <MetaItem label="Messages" value={formatNumber(detail.message_count)} />
                      <MetaItem label="Tool Calls" value={formatNumber(detail.tool_call_count)} />
                      <MetaItem label="API Calls" value={formatNumber(detail.api_call_count)} />
                      <MetaItem label="Input Tokens" value={formatNumber(detail.input_tokens)} />
                      <MetaItem label="Output Tokens" value={formatNumber(detail.output_tokens)} />
                      <MetaItem label="Reasoning Tokens" value={formatNumber(detail.reasoning_tokens)} />
                      <MetaItem label="Cache Read Tokens" value={formatNumber(detail.cache_read_tokens)} />
                      <MetaItem label="Cache Write Tokens" value={formatNumber(detail.cache_write_tokens)} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        Billing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <MetaItem label="Estimated" value={formatMoney(detail.estimated_cost_usd)} />
                      <MetaItem label="Actual" value={formatMoney(detail.actual_cost_usd)} />
                      <MetaItem label="Provider" value={detail.billing_provider || "-"} />
                      <MetaItem label="Mode" value={detail.billing_mode || "-"} />
                      <MetaItem label="Cost Status" value={detail.cost_status || "-"} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        Lineage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <MetaItem label="Session ID" value={detail.id} />
                      <MetaItem label="Parent Session" value={detail.parent_session_id || "-"} />
                      <MetaItem label="User ID" value={detail.user_id || "-"} />
                      <MetaItem label="End Reason" value={detail.end_reason || "-"} />
                    </CardContent>
                  </Card>

                  {detail.system_prompt ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">System Prompt</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{detail.system_prompt}</pre>
                      </CardContent>
                    </Card>
                  ) : null}

                  {detail.model_config ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          Model Config
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{detail.model_config}</pre>
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : null}
            </div>
          </ScrollArea>

          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-4 p-6">
              <div>
                <div className="text-sm font-medium">Messages</div>
                <div className="text-xs text-muted-foreground">
                  {messages ? `${messages.length} turns loaded` : "Waiting for session messages..."}
                </div>
              </div>
              <Separator />
              {messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <MessageCard key={`${detail?.id || props.sessionId}-${message.id ?? index}`} message={message} />
                  ))}
                </div>
              ) : null}
              {messages && messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages in this session.</div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}