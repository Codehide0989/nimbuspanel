"use client";

import { createContext, useContext, useCallback, useState } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info };
  const styles = {
    success: "border-success/20 bg-success/5",
    error: "border-danger/20 bg-danger/5",
    warning: "border-warning/20 bg-warning/5",
    info: "border-primary/20 bg-primary/5",
  };
  const iconStyles = { success: "text-success", error: "text-danger", warning: "text-warning", info: "text-primary" };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border glass-elevated animate-slide-in", styles[t.type])}>
                <Icon size={15} className={iconStyles[t.type]} />
                <p className="text-[13px] text-foreground flex-1">{t.message}</p>
                <button onClick={() => remove(t.id)} className="text-muted hover:text-foreground transition-colors">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}
