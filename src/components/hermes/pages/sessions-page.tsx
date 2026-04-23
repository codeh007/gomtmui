"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, MessageSquare, Search, Wrench } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { hermesApi } from "@/lib/hermes/api";
import type { SessionInfo, SessionMessage, SessionSearchResult } from "@/lib/hermes/types";
import { timeAgo } from "@/lib/hermes/utils";

type VisibleSession = {
  id: string;
  is_active: boolean;
  last_active: number | null;
  message_count: number | null;
  model: string | null;
  preview: string | null;
  source: string | null;
  title: string | null;
  tool_call_count: number | null;
};

function buildSearchOnlySession(result: SessionSearchResult): VisibleSession {
  return {
    id: result.session_id,
    is_active: false,
    last_active: result.session_started,
    message_count: null,
    model: result.model,
    preview: result.role ? `Search hit in ${result.role} message` : "Search hit",
    source: result.source,
    title: null,
    tool_call_count: null,
  };
}

function SnippetHighlight({ snippet }: { snippet: string }) {
  const parts: ReactNode[] = [];
  const regex = />>>(.*?)<<</g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(snippet)) !== null) {
    if (match.index > lastIndex) {
      parts.push(snippet.slice(lastIndex, match.index));
    }
    parts.push(
      <mark key={key++} className="rounded bg-warning/25 px-1">
        {match[1]}
      </mark>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < snippet.length) {
    parts.push(snippet.slice(lastIndex));
  }

  return <div className="text-xs text-muted-foreground">{parts}</div>;
}

function ToolCallBlock({
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
    <div className="mt-2 overflow-hidden rounded-md border border-warning/30 bg-warning/5">
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

function MessageBubble({ message }: { message: SessionMessage }) {
  const roleTone: Record<SessionMessage["role"], string> = {
    assistant: "bg-emerald-500/10 border-emerald-500/20",
    system: "bg-muted border-border",
    tool: "bg-warning/10 border-warning/20",
    user: "bg-primary/10 border-primary/20",
  };

  const label = message.tool_name ? `tool:${message.tool_name}` : message.role;

  return (
    <div className={`rounded-lg border p-3 ${roleTone[message.role]}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{label}</Badge>
        {message.timestamp ? <span>{timeAgo(message.timestamp)}</span> : null}
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
      {message.tool_calls?.length ? (
        <div className="mt-2">
          {message.tool_calls.map((toolCall) => (
            <ToolCallBlock key={toolCall.id} toolCall={toolCall} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SessionRow({
  expanded,
  onToggle,
  searchSnippet,
  session,
}: {
  expanded: boolean;
  onToggle: () => void;
  searchSnippet?: string;
  session: VisibleSession;
}) {
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || messages !== null || loadingMessages) {
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    setMessageError(null);
    hermesApi
      .getSessionMessages(session.id)
      .then((response) => {
        if (cancelled) return;
        setMessages(response.messages);
        setMessageError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMessageError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, loadingMessages, messages, session.id]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-muted/40"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="truncate font-medium">{session.title || session.preview || "Untitled session"}</span>
            {session.is_active ? <Badge>live</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
            <span>{session.source || "local"}</span>
            <span>{session.model || "unknown model"}</span>
            <span>{session.message_count ?? "?"} msgs</span>
            <span>{session.tool_call_count ?? "?"} tools</span>
            <span>{session.last_active ? timeAgo(session.last_active) : "unknown"}</span>
          </div>
          {searchSnippet ? <div className="mt-2 pl-6"><SnippetHighlight snippet={searchSnippet} /></div> : null}
        </div>
      </button>

      {expanded ? (
        <div className="border-t bg-background/60 px-4 py-4">
          {loadingMessages ? <div className="text-sm text-muted-foreground">Loading messages...</div> : null}
          {messageError ? <div className="text-sm text-destructive">{messageError}</div> : null}
          {messages && messages.length === 0 ? <div className="text-sm text-muted-foreground">No messages.</div> : null}
          {messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <MessageBubble key={`${session.id}-${index}`} message={message} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function HermesSessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SessionSearchResult[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const response = await hermesApi.getSessions(100, 0);
        if (cancelled) return;
        setSessions(response.sessions);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void loadSessions();
    const interval = setInterval(() => {
      void loadSessions();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    searchRequestVersionRef.current += 1;
    const requestVersion = searchRequestVersionRef.current;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      hermesApi
        .searchSessions(query.trim())
        .then((response) => {
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults(response.results);
        })
        .catch(() => {
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults(null);
        })
        .finally(() => {
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearching(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const snippetMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const result of searchResults ?? []) {
      if (!map.has(result.session_id)) {
        map.set(result.session_id, result.snippet);
      }
    }
    return map;
  }, [searchResults]);

  const sessionsById = useMemo(() => {
    return new Map(sessions.map((session) => [session.id, session]));
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    if (!searchResults) {
      return sessions;
    }

    const seen = new Set<string>();
    const merged: VisibleSession[] = [];

    for (const result of searchResults) {
      if (seen.has(result.session_id)) {
        continue;
      }
      seen.add(result.session_id);
      merged.push(sessionsById.get(result.session_id) ?? buildSearchOnlySession(result));
    }

    return merged;
  }, [searchResults, sessions, sessionsById]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Sessions
              <Badge variant="secondary">{sessions.length}</Badge>
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search Hermes sessions" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          Search uses Hermes session search and filters the locally loaded session list. Expand a row to fetch messages on demand.
          {searching ? <span className="ml-2">Searching...</span> : null}
        </CardContent>
      </Card>

      {error ? <div className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {loading ? <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">Loading sessions...</div> : null}
      {!loading && !error && visibleSessions.length === 0 ? (
        <div className="rounded-lg border px-4 py-8 text-sm text-muted-foreground">No matching sessions found.</div>
      ) : null}

      <div className="space-y-3">
        {visibleSessions.map((session) => (
          <SessionRow
            key={session.id}
            expanded={expandedId === session.id}
            onToggle={() => setExpandedId((current) => (current === session.id ? null : session.id))}
            searchSnippet={snippetMap.get(session.id)}
            session={session}
          />
        ))}
      </div>
    </div>
  );
}
