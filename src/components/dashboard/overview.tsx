"use client";

import { type LucideIcon, Megaphone, Server, Users, Zap } from "lucide-react";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import Link from "next/link";
import { z } from "zod";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { useCurrentUserRole } from "@/hooks/use-current-user-role";
import { CampaignRecordSchema } from "../campaigns/schemas";
import { CloudAccountRecordSchema } from "../cloud-account/schemas";
import { ContactRecordSchema } from "../contacts/schemas";

export function DashboardOverview() {
  const { isAdmin } = useCurrentUserRole();

  const accountsQuery = useRpcQuery(
    "cloud_account_list_cursor",
    { p_limit: 5 },
    { schema: z.array(CloudAccountRecordSchema) },
  );

  const campaignsQuery = useRpcQuery("campaign_list_cursor", { p_limit: 5 }, { schema: z.array(CampaignRecordSchema) });

  const contactsQuery = useRpcQuery("contact_list_cursor", { p_limit: 1 }, { schema: z.array(ContactRecordSchema) });

  const serverInstancesQuery = useRpcQuery(
    "server_list_cursor",
    { p_limit: 100 },
    {
      schema: z.array(
        z.object({
          id: z.string(),
          state: z.any().nullable(),
        }),
      ),
    },
  );

  const serverInstances = serverInstancesQuery.data;
  const accounts = accountsQuery.data;
  const campaigns = campaignsQuery.data;
  const contacts = contactsQuery.data;

  const onlineCount = serverInstances?.filter((s) => s.state?.status === "ready").length ?? 0;

  const connectedAccounts = accounts?.length || 0;
  const activeCampaigns = campaigns?.filter((c) => c.status === "active").length || 0;
  const hasContacts = contacts && contacts.length > 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ErrorBoundary name="DashboardStats:Accounts" fallback={<StatsCardFallback title="Connected Accounts" />}>
          <StatsCard
            title="Connected Accounts"
            value={connectedAccounts.toString()}
            icon={Zap}
            description="Active cloud accounts"
            emptyDescription="No accounts connected"
            isEmpty={connectedAccounts === 0}
            href="/dash/cloud-accounts"
            status={getQueryStatus(accountsQuery)}
          />
        </ErrorBoundary>
        <ErrorBoundary name="DashboardStats:Campaigns" fallback={<StatsCardFallback title="Active Campaigns" />}>
          <StatsCard
            title="Active Campaigns"
            value={activeCampaigns.toString()}
            icon={Megaphone}
            description="Running campaigns"
            emptyDescription="No active campaigns"
            isEmpty={activeCampaigns === 0}
            href="/dash/campaigns"
            status={getQueryStatus(campaignsQuery)}
          />
        </ErrorBoundary>
        {isAdmin && (
          <ErrorBoundary name="DashboardStats:Instances" fallback={<StatsCardFallback title="Server Instances" />}>
            <StatsCard
              title="Server Instances"
              value={onlineCount.toString()}
              icon={Server}
              description="Online instances"
              emptyDescription="No online instances"
              isEmpty={onlineCount === 0}
              href="/dash/instances"
              status={getQueryStatus(serverInstancesQuery)}
            />
          </ErrorBoundary>
        )}
        <ErrorBoundary name="DashboardStats:Contacts" fallback={<StatsCardFallback title="Contacts" />}>
          <StatsCard
            title="Contacts"
            value={hasContacts ? "Active" : "None"}
            icon={Users}
            description="CRM contacts"
            emptyDescription="No contacts yet"
            isEmpty={!hasContacts}
            href="/dash/contacts"
            status={getQueryStatus(contactsQuery)}
          />
        </ErrorBoundary>
        <ErrorBoundary name="Dashboard:Assistant" fallback={<StatsCardFallback title="Assistant" />}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assistant</CardTitle>
              <div className="h-4 w-4 text-muted-foreground">🤖</div>
            </CardHeader>
            <CardContent className="min-h-[88px]">
              <Button variant="link" className="p-0 h-auto font-bold text-2xl" asChild>
                <Link href="/chat">Chat Now</Link>
              </Button>
              <p className="text-xs text-muted-foreground">AI Agent Assistant</p>
            </CardContent>
          </Card>
        </ErrorBoundary>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <ErrorBoundary name="Dashboard:RecentCampaigns" fallback={<ListCardFallback title="Recent Campaigns" />}>
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="min-h-[140px]">
              {campaignsQuery.isLoading ? (
                <CardStateMessage message="Loading campaigns..." />
              ) : campaignsQuery.error ? (
                <CardStateMessage message="Failed to load campaigns." tone="error" />
              ) : campaigns && campaigns.length > 0 ? (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.status}</p>
                      </div>
                      <div className="ml-auto font-medium">
                        <Link
                          href={`/dash/campaigns/${campaign.id}/edit`}
                          className="text-blue-500 hover:underline text-sm"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <CardStateMessage message="No campaigns found." />
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>

        <ErrorBoundary name="Dashboard:Accounts" fallback={<ListCardFallback title="Accounts" />}>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
            </CardHeader>
            <CardContent className="min-h-[140px]">
              {accountsQuery.isLoading ? (
                <CardStateMessage message="Loading accounts..." />
              ) : accountsQuery.error ? (
                <CardStateMessage message="Failed to load accounts." tone="error" />
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{acc.platform_name}</p>
                        <p className="text-xs text-muted-foreground">{acc.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <CardStateMessage message="No accounts connected." />
              )}
            </CardContent>
          </Card>
        </ErrorBoundary>
      </div>
    </div>
  );
}

type QueryStatus = "ok" | "loading" | "error";

function getQueryStatus(query: { isLoading?: boolean; error?: Error | null }): QueryStatus {
  if (query.error) {
    return "error";
  }
  if (query.isLoading) {
    return "loading";
  }
  return "ok";
}

function CardStateMessage({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  return <div className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</div>;
}

function ListCardFallback({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[140px]">
        <CardStateMessage message="Failed to render section." tone="error" />
      </CardContent>
    </Card>
  );
}

function StatsCardFallback({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[88px]">
        <div className="text-2xl font-bold leading-8 min-h-[32px]">Unavailable</div>
        <p className="text-xs text-destructive">Failed to render card.</p>
      </CardContent>
    </Card>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  emptyDescription,
  isEmpty,
  href,
  status = "ok",
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  description: string;
  emptyDescription?: string;
  isEmpty?: boolean;
  href: string;
  status?: QueryStatus;
}) {
  const isLinkable = status === "ok" && href;
  const displayValue = status === "error" ? "Unavailable" : status === "loading" ? "—" : value;
  const displayDescription =
    status === "error" ? "Failed to load" : isEmpty && emptyDescription ? emptyDescription : description;
  const descriptionTone = status === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="min-h-[88px]">
        <div className="text-2xl font-bold leading-8 min-h-[32px]">
          {isLinkable ? (
            <Link href={href} className="hover:underline">
              {displayValue}
            </Link>
          ) : (
            displayValue
          )}
        </div>
        <p className={`text-xs ${descriptionTone}`}>{displayDescription}</p>
      </CardContent>
    </Card>
  );
}
