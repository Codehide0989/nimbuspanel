"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
        <AlertTriangle size={22} className="text-danger" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-secondary max-w-xs mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-card-hover transition-all"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
