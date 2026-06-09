"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-emerald-900 shadow-float",
  error: "border-red-200 bg-white text-red-900 shadow-float",
  info: "border-sky-200 bg-white text-sky-900 shadow-float",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-600",
  error: "text-red-500",
  info: "text-sky-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-up flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${STYLES[t.type]}`}
            role="status"
          >
            {t.type === "success" ? (
              <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_STYLES[t.type]}`} />
            ) : (
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.type === "error" ? "bg-red-500" : "bg-sky-500"}`}
                aria-hidden
              />
            )}
            <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
