"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal
        className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className={variant === "danger" ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" : ""}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
