import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-display text-8xl text-pink mb-4">404</p>
        <h1 className="font-display text-3xl text-white mb-2">PÁGINA NÃO ENCONTRADA</h1>
        <p className="text-gray-2 mb-8">
          A página que você procura não existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-pink text-white rounded-xl font-medium hover:bg-pink-light transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
