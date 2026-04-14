import type { AndroidSessionInfoItem } from "./p2p-android-viewport-support";

export function AndroidSessionInfoSection({ items, title }: { items: AndroidSessionInfoItem[]; title: string }) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-medium text-zinc-100">{title}</div>
      <dl className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</dt>
            <dd className="break-all text-sm text-zinc-100">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
