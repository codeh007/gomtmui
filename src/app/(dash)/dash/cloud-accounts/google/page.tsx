"use client";

import { Plus } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "mtxuilib/ui/dialog";
import { useState } from "react";
import { AddAccountView } from "@/app/(dash)/dash/cloud-accounts/components/AddAccountView";
import { CloudAccountList } from "@/app/(dash)/dash/cloud-accounts/components/CloudAccountList";
import { ReauthFlow } from "@/app/(dash)/dash/cloud-accounts/components/ReauthFlow";
import { DeviceProfileCard } from "@/components/cloud-account/device/DeviceProfileCard";
import { useCloudAccounts } from "@/components/cloud-account/hooks/useCloudAccounts";
import type { CloudAccount } from "@/components/cloud-account/schemas";
import { DashContent, DashHeaders } from "@/components/dash-layout";
import { ImportGoogleJsonDialog } from "./components/ImportGoogleJsonDialog";

export default function GoogleAccountsPage() {
  const [deviceProfileAccount, setDeviceProfileAccount] = useState<CloudAccount | null>(null);
  const [reauthAccount, setReauthAccount] = useState<CloudAccount | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useCloudAccounts(
    {
      platformName: "google",
      pageSize: 50,
    },
  );

  const accounts = data?.pages.flat() || [];

  return (
    <>
      <DashHeaders>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash/cloud-accounts">Cloud Accounts</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Google</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Google Accounts</h1>
            <p className="text-muted-foreground text-sm">Manage Google Cloud accounts for Vertex AI / Gemini access.</p>
          </div>
          <div className="flex gap-2">
            <ImportGoogleJsonDialog />
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                <AddAccountView onSuccess={() => setIsAddOpen(false)} onCancel={() => setIsAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <CloudAccountList
          isLoading={isLoading}
          isError={isError}
          error={error}
          accounts={accounts}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          onDeviceProfile={setDeviceProfileAccount}
          onReauth={setReauthAccount}
          onResetFilters={() => {}}
          hasActiveFilters={false}
          onRefresh={() => refetch()}
        />

        <Dialog open={!!deviceProfileAccount} onOpenChange={(open) => !open && setDeviceProfileAccount(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {deviceProfileAccount && <DeviceProfileCard account={deviceProfileAccount} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!reauthAccount} onOpenChange={(open) => !open && setReauthAccount(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 reauth-dialog">
            {reauthAccount && (
              <ReauthFlow
                account={reauthAccount}
                onSuccess={() => setReauthAccount(null)}
                onCancel={() => setReauthAccount(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </DashContent>
    </>
  );
}
