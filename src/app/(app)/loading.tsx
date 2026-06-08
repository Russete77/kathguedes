export default function AppLoading() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-pink border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-2 text-sm">Carregando...</p>
      </div>
    </div>
  );
}
