import type { ReactNode } from "react";

type BadgeVariant = "default" | "type" | "ready" | "processing" | "error" | "category";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-600",
  type: "bg-mech-50 text-mech-700 ring-1 ring-mech-100",
  ready: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  processing: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  error: "bg-red-50 text-red-700 ring-1 ring-red-100",
  category: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
