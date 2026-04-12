"use client";

import { Plus } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "mtxuilib/ui/dialog";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddAccountView } from "@/app/(dash)/dash/cloud-accounts/components/AddAccountView";
import { ReauthFlow } from "@/app/(dash)/dash/cloud-accounts/components/ReauthFlow";

import { DeviceProfileCard } from "@/components/cloud-account/device/DeviceProfileCard";
import { useCloudAccounts } from "@/components/cloud-account/hooks/useCloudAccounts";
import { useTokenAutoRefresh } from "@/components/cloud-account/hooks/useTokenRefresh";
import type { CloudAccount, CloudAccountStatus } from "@/components/cloud-account/schemas";
import { ErrorBoundary } from "@/components/common/error-boundary";

import { DashContent, DashHeaders } from "@/components/dash-layout";
import { useDebounce } from "@/hooks/use-debounce";
import { CloudAccountFilters } from "./components/CloudAccountFilters";
import { CloudAccountList } from "./components/CloudAccountList";

export default function CloudAccountsPage() {
  useTokenAutoRefresh();

  const [kw, setKw] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deviceProfileAccount, setDeviceProfileAccount] = useState<CloudAccount | null>(null);
  const [reauthAccount, setReauthAccount] = useState<CloudAccount | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get("code") && searchParams?.get("state")) {
      setIsAddOpen(true);
    }
  }, [searchParams]);

  const kwDebounced = useDebounce(kw, 500);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useCloudAccounts(
    {
      kw: kwDebounced,
      platformName: platform === "all" ? undefined : platform,
      status: status === "all" ? undefined : (status as CloudAccountStatus),
      pageSize: 20,
    },
  );

  const accounts = data?.pages.flat() || [];

  const handleResetFilters = () => {
    setKw("");
    setPlatform("all");
    setStatus("all");
  };

  const hasActiveFilters = kw || platform !== "all" || status !== "all";

  return (
    <>
      <DashHeaders>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Cloud Accounts</h1>
          <p className="text-xs text-muted-foreground">管理云平台账号</p>
        </div>
      </DashHeaders>

      <DashContent className="flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
        <ErrorBoundary name="CloudAccountsList">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <CloudAccountFilters
              kw={kw}
              setKw={setKw}
              platform={platform}
              setPlatform={setPlatform}
              status={status}
              setStatus={setStatus}
              onReset={handleResetFilters}
            />

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>Add Cloud Account</DialogTitle>
                  <DialogDescription>
                    Connect your cloud platform account to start managing assets and automation.
                  </DialogDescription>
                </DialogHeader>
                <AddAccountView onSuccess={() => setIsAddOpen(false)} onCancel={() => setIsAddOpen(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={!!deviceProfileAccount} onOpenChange={(open) => !open && setDeviceProfileAccount(null)}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Device Profile</DialogTitle>
                  <DialogDescription>
                    Manage technical metadata and browser fingerprint for this account.
                  </DialogDescription>
                </DialogHeader>
                {deviceProfileAccount && <DeviceProfileCard account={deviceProfileAccount} />}
              </DialogContent>
            </Dialog>

            <Dialog open={!!reauthAccount} onOpenChange={(open) => !open && setReauthAccount(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 reauth-dialog">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>
                    Re-authenticate Account: {reauthAccount?.account_name || reauthAccount?.account_email}
                  </DialogTitle>
                  <DialogDescription>
                    Your session for <strong>{reauthAccount?.account_name || reauthAccount?.account_email}</strong> has
                    expired or requires attention. Please complete the authentication steps below to restore access.
                  </DialogDescription>
                </DialogHeader>
                {reauthAccount && (
                  <ReauthFlow
                    account={reauthAccount}
                    onSuccess={() => setReauthAccount(null)}
                    onCancel={() => setReauthAccount(null)}
                  />
                )}
              </DialogContent>
            </Dialog>
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
            onResetFilters={handleResetFilters}
            hasActiveFilters={!!hasActiveFilters}
            onRefresh={() => refetch()}
          />
        </ErrorBoundary>
      </DashContent>
    </>
  );
}
