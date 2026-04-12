import { format } from "date-fns";
import { Edit, Pause, Play } from "lucide-react";
import { Badge } from "mtxuilib/ui/badge";
import { Button } from "mtxuilib/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemTitle } from "mtxuilib/ui/item";
import type { CampaignRecord } from "./schemas";

interface CampaignListItemProps {
  campaign: CampaignRecord;
  onEdit: (campaign: CampaignRecord) => void;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
}

export const CampaignListItem = ({ campaign, onEdit, onStart, onPause }: CampaignListItemProps) => {
  return (
    <Item>
      <ItemContent>
        <ItemHeader>
          <ItemTitle>{campaign.name}</ItemTitle>
          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge>
        </ItemHeader>
        <ItemDescription>{campaign.description || "No description"}</ItemDescription>
        <ItemFooter className="text-xs text-muted-foreground mt-2">
          Platform: {campaign.platform} | Created:{" "}
          {campaign.created_at ? format(new Date(campaign.created_at), "yyyy-MM-dd HH:mm") : "-"}
        </ItemFooter>
      </ItemContent>
      <ItemActions>
        {campaign.status !== "active" && (
          <Button size="sm" variant="outline" onClick={() => onStart(campaign.id)}>
            <Play className="mr-2 h-4 w-4" /> Start
          </Button>
        )}
        {campaign.status === "active" && (
          <Button size="sm" variant="outline" onClick={() => onPause(campaign.id)}>
            <Pause className="mr-2 h-4 w-4" /> Pause
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEdit(campaign)}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </ItemActions>
    </Item>
  );
};
