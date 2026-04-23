import { HermesNav } from "./hermes-nav";

export function HermesShell(props: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border bg-card/40">
        <div className="border-b px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Hermes Agent Web</div>
          <div className="mt-2 flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{props.description}</p>
          </div>
        </div>
        <div className="p-3">
          <HermesNav />
        </div>
      </div>
      <div className="flex flex-col gap-4">{props.children}</div>
    </div>
  );
}
