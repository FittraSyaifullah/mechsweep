"use client";

import { createContext, useCallback, useContext, useState } from "react";

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
  success: "border-emerald-200 bg-white text-emerald-800",
  error: "border-red-200 bg-white text-red-800",
  info: "border-sky-200 bg-white text-sky-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

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
            className={`animate-slide-up rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[t.type]}`}
          >
            {t.message}
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
