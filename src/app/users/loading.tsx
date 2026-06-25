export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 space-y-5">
        <div className="flex justify-between"><div className="h-3 w-20 rounded shimmer" /><div className="h-8 w-20 rounded-xl shimmer" /></div>
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border"><div className="h-3 w-16 rounded shimmer" /></div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <div className="h-8 w-8 rounded-xl shimmer" />
              <div className="space-y-1 flex-1"><div className="h-3 w-32 rounded shimmer" /><div className="h-2 w-24 rounded shimmer" /></div>
              <div className="h-5 w-14 rounded-lg shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
