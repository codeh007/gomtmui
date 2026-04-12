"use client";

import { format } from "date-fns";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Card, CardContent, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Separator } from "mtxuilib/ui/separator";
import { z } from "zod";
import { CloudAccountRecordSchema } from "@/components/cloud-account/schemas";
import { StatusBadge } from "@/components/cloud-account/status/StatusBadge";

export default function AccountOverviewPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data } = useRpcQuery("cloud_account_get", { p_id: id }, { schema: z.array(CloudAccountRecordSchema) });
  const account = data?.[0];

  if (!account) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account Overview</h3>
        <p className="text-sm text-muted-foreground">Basic information about your account.</p>
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={account.status} reason={account.status_reason} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium capitalize">{account.platform_name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Account Name</span>
              <span className="font-medium">{account.account_name || "-"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Email / Identifier</span>
              <span className="font-medium">{account.account_email || "-"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Created At</span>
              <span className="font-medium">
                {account.created_at ? format(new Date(account.created_at), "PPP p") : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Used</span>
              <span className="font-medium">
                {account.last_used_at ? format(new Date(account.last_used_at), "PPP p") : "Never"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-medium">Raw Data</h3>
        <p className="text-sm text-muted-foreground mb-4">Technical details for debugging.</p>
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(account, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
