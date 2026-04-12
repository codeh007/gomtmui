import { FilterX, Search } from "lucide-react";
import { Button } from "mtxuilib/ui/button";
import { Input } from "mtxuilib/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { CloudAccountStatusEnum } from "@/components/cloud-account/schemas";
import { PLATFORM_CONFIGS } from "@/lib/cloud-account/platform-configs";

interface CloudAccountFiltersProps {
  kw: string;
  setKw: (kw: string) => void;
  platform: string;
  setPlatform: (platform: string) => void;
  status: string;
  setStatus: (status: string) => void;
  onReset: () => void;
}

export function CloudAccountFilters({
  kw,
  setKw,
  platform,
  setPlatform,
  status,
  setStatus,
  onReset,
}: CloudAccountFiltersProps) {
  const hasActiveFilters = kw || platform !== "all" || status !== "all";

  return (
    <div className="flex flex-1 w-full md:w-auto gap-2 items-center">
      <div className="relative flex-1 md:max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search accounts..."
          className="pl-9"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
      </div>

      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Platforms</SelectItem>
          {Object.values(PLATFORM_CONFIGS).map((p) => (
            <SelectItem key={p.name} value={p.name}>
              {p.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {CloudAccountStatusEnum.options.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="icon" onClick={onReset} title="Reset filters">
          <FilterX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
