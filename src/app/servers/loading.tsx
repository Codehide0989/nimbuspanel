export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-xl shimmer" />
          <div className="h-8 w-28 rounded-xl shimmer" />
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-3 w-14 rounded shimmer" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/30">
              <div className="h-2.5 w-2.5 rounded-full shimmer" />
              <div className="h-3 w-28 rounded shimmer" />
              <div className="h-3 w-24 rounded shimmer hidden md:block" />
              <div className="h-3 w-20 rounded shimmer hidden lg:block" />
              <div className="h-3 w-16 rounded shimmer ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
