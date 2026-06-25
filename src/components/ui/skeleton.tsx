import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20 hidden md:block" />
          <Skeleton className="h-3 w-16 hidden lg:block" />
          <Skeleton className="h-3 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton />
      </div>
    </div>
  );
}
