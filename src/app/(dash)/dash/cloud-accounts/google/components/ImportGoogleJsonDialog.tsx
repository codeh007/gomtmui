"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileJson, Upload } from "lucide-react";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Button } from "mtxuilib/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "mtxuilib/ui/dialog";
import { Textarea } from "mtxuilib/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

interface GoogleAccountJson {
  email: string;
  refresh_token: string;
}

export function ImportGoogleJsonDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const supabase = useSupabaseBrowser();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setJsonContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!jsonContent.trim()) return;

    setIsImporting(true);
    try {
      let data: GoogleAccountJson[];
      try {
        const parsed = JSON.parse(jsonContent);
        // data can be array or object
        data = Array.isArray(parsed) ? parsed : [parsed];
      } catch (_) {
        toast.error("Invalid JSON format");
        return;
      }

      if (!data.length) {
        toast.error("No accounts found in JSON");
        return;
      }

      // Validate structure
      const validAccounts = data.filter((acc) => acc.email && acc.refresh_token);
      if (validAccounts.length === 0) {
        toast.error("No valid accounts found (must have email and refresh_token)");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      // Upsert into Supabase
      const upsertData = validAccounts.map((acc) => ({
        user_id: user.id,
        platform_name: "google",
        account_email: acc.email,
        refresh_token: acc.refresh_token,
        status: "active" as any,
        token_type: "Bearer",
        use_count: 0,
        proxy_disabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("cloud_accounts")
        .upsert(upsertData, { onConflict: "platform_name,account_email", ignoreDuplicates: false });

      if (error) throw error;

      toast.success(`Successfully imported ${validAccounts.length} accounts`);
      setIsOpen(false);
      setJsonContent("");
      void queryClient.invalidateQueries({ queryKey: getRpcQueryKey("cloud_account_list_cursor") });
    } catch (error) {
      console.error("Import failed:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Google Accounts</DialogTitle>
          <DialogDescription>
            Import accounts from a JSON file or paste JSON content. Expected format: Array of objects with email and
            refresh_token.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              className="relative w-full"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <FileJson className="mr-2 h-4 w-4" />
              Select JSON File
              <input id="file-upload" type="file" accept=".json" className="hidden" onChange={handleFileChange} />
            </Button>
          </div>
          <div className="grid gap-2">
            <Textarea
              placeholder='[{"email": "user@gmail.com", "refresh_token": "..."}]'
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
