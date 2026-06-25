export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full shimmer" />
          <div className="h-3 w-20 rounded shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded shimmer" />
                <div className="h-5 w-12 rounded shimmer" />
              </div>
              <div className="h-2 w-16 rounded shimmer" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded-lg shimmer" />
                <div className="h-12 rounded-lg shimmer" />
                <div className="h-12 rounded-lg shimmer" />
              </div>
              <div className="h-1.5 rounded-full shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
