import { LoadingSpinner } from "mtxuilib/mt/skeletons";
import { Button } from "mtxuilib/ui/button";
import { CloudAccountCard } from "@/components/cloud-account/CloudAccountCard";
import type { CloudAccount } from "@/components/cloud-account/schemas";

interface CloudAccountListProps {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  accounts: CloudAccount[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onDeviceProfile: (account: CloudAccount) => void;
  onReauth: (account: CloudAccount) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  onRefresh?: () => void;
}

export function CloudAccountList({
  isLoading,
  isError,
  error,
  accounts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onDeviceProfile,
  onReauth,
  onResetFilters,
  hasActiveFilters,
  onRefresh,
}: CloudAccountListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col justify-center items-center h-40 text-red-500">
        <p>Error loading accounts: {error?.message}</p>
        <Button variant="outline" onClick={() => (onRefresh ? onRefresh() : window.location.reload())} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-40 text-muted-foreground">
        <p>No Cloud Accounts found.</p>
        {hasActiveFilters && (
          <Button variant="link" onClick={onResetFilters}>
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
        {accounts.map((account) => (
          <CloudAccountCard key={account.id} account={account} onDeviceProfile={onDeviceProfile} onReauth={onReauth} />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
