import type { ReactNode } from "react";
import Button from "@/components/ui/Button";

type AlertVariant = "error" | "info" | "success" | "warning";

const STYLES: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

interface AlertProps {
  variant?: AlertVariant;
  title: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
}

export default function Alert({
  variant = "info",
  title,
  detail,
  onRetry,
  retryLabel = "Try again",
  action,
}: AlertProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`} role="alert">
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-1 text-[13px] leading-relaxed opacity-90">{detail}</p>}
      {(onRetry || action) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
