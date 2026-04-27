export async function executeSlashCommand(cmd: string): Promise<string> {
  const response = await fetch("/api/slash/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: cmd }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.output || "";
}
