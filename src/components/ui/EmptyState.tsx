import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
