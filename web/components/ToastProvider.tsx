"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, CloseIcon } from "./icons";

type ToastKind = "success" | "error" | "info";

type ToastOptions = {
  kind?: ToastKind;
  title?: string;
  duration?: number;
};

type ToastItem = Required<Pick<ToastOptions, "kind" | "duration">> & {
  id: number;
  message: string;
  title?: string;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => number;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { accent: string; icon: string }> = {
  success: {
    accent: "border-l-emerald-500",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  error: {
    accent: "border-l-rose-500",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
  info: {
    accent: "border-l-sky-500",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") return <CheckIcon className="h-4 w-4" />;
  if (kind === "error") return <span className="text-sm font-bold">!</span>;
  return <span className="text-sm font-semibold">i</span>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const duration = options.duration ?? 4500;
      const item: ToastItem = {
        id,
        message,
        title: options.title,
        kind: options.kind ?? "info",
        duration,
      };

      setToasts((current) => [...current.slice(-3), item]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissToast(id), duration),
        );
      }
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[min(24rem,calc(100vw-2.5rem))]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const styles = KIND_STYLES[toast.kind];
          return (
            <div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border border-zinc-200 border-l-4 bg-white/95 p-3.5 shadow-xl shadow-zinc-900/10 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-black/30 ${styles.accent}`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${styles.icon}`}
              >
                <ToastIcon kind={toast.kind} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {toast.title && (
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {toast.title}
                  </p>
                )}
                <p className="break-words text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Dismiss notification"
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
      </div>
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
