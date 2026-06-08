import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTrainingSplits } from "./actions";
import { SplitsEditor } from "./splits-editor";

export const metadata = { title: "Splits por frequência" };
export const dynamic = "force-dynamic";

export default async function SplitsPage() {
  const splits = await getTrainingSplits();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/consultorias"
        className="inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para consultorias
      </Link>

      <div>
        <h1 className="font-display text-4xl text-white">DIVISÕES POR FREQUÊNCIA</h1>
        <p className="text-gray-2 text-sm mt-1">
          Define quais dias a IA usa para cada frequência semanal. Os nomes dos dias
          (slots) devem bater com o <strong>slot do split</strong> que você marca nos
          vídeos da biblioteca.
        </p>
      </div>

      <SplitsEditor initial={splits} />
    </div>
  );
}
