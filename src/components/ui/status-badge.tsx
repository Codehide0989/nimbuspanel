import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const config: Record<string, { color: string; label: string; pulse: boolean }> = {
  running: { color: "bg-success", label: "Running", pulse: true },
  stopped: { color: "bg-danger", label: "Stopped", pulse: false },
  pending: { color: "bg-warning", label: "Pending", pulse: true },
  "shutting-down": { color: "bg-warning", label: "Shutting down", pulse: true },
  terminated: { color: "bg-muted", label: "Terminated", pulse: false },
  stopping: { color: "bg-warning", label: "Stopping", pulse: true },
  unknown: { color: "bg-muted", label: "Unknown", pulse: false },
};

export function StatusBadge({ status, showLabel = true, size = "sm" }: StatusBadgeProps) {
  const c = config[status] ?? config.unknown;
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex">
        {c.pulse && (
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", c.color, dotSize)} />
        )}
        <span className={cn("relative inline-flex rounded-full", c.color, dotSize)} />
      </span>
      {showLabel && (
        <span className="text-[11px] font-medium text-secondary capitalize">{c.label}</span>
      )}
    </div>
  );
}
