export default function ChatLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div>
        <div className="h-8 w-48 bg-bg-2 rounded-lg animate-pulse" />
        <div className="h-4 w-64 bg-bg-2 rounded mt-2 animate-pulse" />
      </div>
      <div className="flex-1 space-y-3 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`h-12 rounded-2xl bg-bg-2 animate-pulse ${
                i % 2 === 0 ? "w-2/3" : "w-1/2"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
