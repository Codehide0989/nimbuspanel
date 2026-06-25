import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4" : "py-20 px-6",
      className
    )}>
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-card to-surface border border-border flex items-center justify-center">
          <Icon size={24} className="text-secondary" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-secondary max-w-md mb-6 leading-relaxed">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
