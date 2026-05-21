export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="h-10 w-56 bg-bg-2 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-bg-2 rounded mt-2 animate-pulse" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-1 rounded-2xl border border-gray-4 p-5 space-y-3">
            <div className="h-4 w-20 bg-bg-2 rounded animate-pulse" />
            <div className="h-8 w-16 bg-bg-2 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-bg-1 rounded-2xl border border-gray-4 p-5 h-64 animate-pulse" />
    </div>
  );
}
