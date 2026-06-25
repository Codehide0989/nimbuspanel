export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-7 w-16 rounded-lg shimmer" />)}</div>
          <div className="h-7 w-20 rounded-lg shimmer" />
        </div>
        <div className="bg-card border border-border rounded-xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <div className="h-8 w-8 rounded-lg shimmer" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-32 rounded shimmer" />
                <div className="h-2 w-48 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
