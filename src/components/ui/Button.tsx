import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/ui/Icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-mech-600 text-white shadow-sm hover:bg-mech-700 focus-visible:ring-mech-500 disabled:bg-slate-200 disabled:text-slate-400",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-300 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300",
  danger: "text-red-600 hover:bg-red-50 focus-visible:ring-red-300",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
  md: "gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
  lg: "gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}
