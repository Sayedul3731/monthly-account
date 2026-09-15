"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { Toaster, toast } from "sonner";

type ToastKind = "success" | "error" | "info";

type ToastOptions = {
  kind?: ToastKind;
  title?: string;
  duration?: number;
};

type ToastId = string | number;

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => ToastId;
  dismissToast: (id: ToastId) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const dismissToast = useCallback((id: ToastId) => toast.dismiss(id), []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const title = options.title ?? message;
      const toastOptions = {
        description: options.title ? message : undefined,
        duration: options.duration ?? 4500,
      };

      if (options.kind === "success") {
        return toast.success(title, toastOptions);
      }
      if (options.kind === "error") {
        return toast.error(title, toastOptions);
      }
      return toast.info(title, toastOptions);
    },
    [],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        theme="system"
        richColors
        closeButton
        visibleToasts={4}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
