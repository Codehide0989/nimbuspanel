export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5 max-w-3xl space-y-5">
        <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 w-20 rounded-lg shimmer" />)}</div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="h-4 w-20 rounded shimmer" />
          <div className="h-9 w-full rounded-xl shimmer" />
          <div className="h-9 w-full rounded-xl shimmer" />
          <div className="h-8 w-28 rounded-xl shimmer" />
        </div>
      </div>
    </div>
  );
}
