export default function Loading() {
  return (
    <div className="min-h-screen bg-bg lg:ml-[230px]">
      <div className="h-14 border-b border-border" />
      <div className="p-5">
        <div className="h-[calc(100vh-8rem)] bg-card border border-border rounded-xl shimmer" />
      </div>
    </div>
  );
}
