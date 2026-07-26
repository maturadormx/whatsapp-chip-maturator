import { Inbox, Keyboard, SearchX } from "lucide-react";

export function AdminSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${count > 2 ? "lg:grid-cols-4" : ""} gap-4`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-premium p-6">
          <div className="admin-skeleton h-10 w-10 rounded-lg mb-5" />
          <div className="admin-skeleton h-3 w-24 rounded mb-2" />
          <div className="admin-skeleton h-8 w-28 rounded" />
        </div>
      ))}
    </div>
  );
}

export function AdminSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="admin-skeleton h-5 w-44 rounded mb-2" />
        <div className="admin-skeleton h-3 w-28 rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-3">
            <div className="admin-skeleton h-10 rounded col-span-2" />
            <div className="admin-skeleton h-10 rounded" />
            <div className="admin-skeleton h-10 rounded" />
            <div className="admin-skeleton h-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  variant = "default",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "default" | "search" | "audit";
}) {
  const Icon = variant === "search" ? SearchX : variant === "audit" ? Keyboard : Inbox;

  return (
    <div className="card-premium-enhanced empty-state-premium p-8 text-center flex flex-col items-center justify-center">
      <div className="empty-state-icon mb-4">
        <Icon className="w-5 h-5 text-indigo-300" />
      </div>
      <h3 className="text-white font-semibold text-lg tracking-tight">{title}</h3>
      <p className="text-slate-400 text-sm mt-2 max-w-md">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ShortcutHint({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
      <Keyboard className="w-3.5 h-3.5 text-indigo-300" />
      {text}
    </div>
  );
}
