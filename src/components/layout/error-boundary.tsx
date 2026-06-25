"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error("[ErrorBoundary]", error); }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Something went wrong</h3>
          <p className="text-xs text-secondary max-w-xs mb-5">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-card-hover transition-all">
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
