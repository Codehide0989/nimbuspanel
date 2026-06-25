export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 space-y-4">
        <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 w-14 rounded-lg shimmer" />)}</div>
        <div className="bg-card border border-border rounded-xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border/30">
              <div className="h-7 w-7 rounded-xl shimmer mt-0.5" />
              <div className="space-y-1.5 flex-1"><div className="h-3 w-40 rounded shimmer" /><div className="h-2 w-56 rounded shimmer" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
