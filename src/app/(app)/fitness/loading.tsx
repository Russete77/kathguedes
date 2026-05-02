export default function FitnessLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-10 w-48 bg-bg-2 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-bg-2 rounded mt-2 animate-pulse" />
        </div>
        <div className="h-12 w-20 bg-bg-2 rounded-xl animate-pulse" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-1 rounded-2xl overflow-hidden border border-gray-4">
            <div className="aspect-video bg-bg-2 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 bg-bg-2 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-bg-2 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
