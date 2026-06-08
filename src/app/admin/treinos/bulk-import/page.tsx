import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BulkImportForm } from "./bulk-import-form";

export const metadata = { title: "Importar Treinos em Massa" };
export const dynamic = "force-dynamic";

export default function BulkImportPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/treinos"
        className="inline-flex items-center gap-2 text-pink text-[13px] font-semibold hover:text-pink-light"
      >
        <ArrowLeft size={14} />
        Voltar para Treinos
      </Link>

      <div>
        <h1 className="font-display text-4xl text-white">
          IMPORTAR VÍDEOS <span className="text-pink">EM MASSA</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Cole a lista de links no formato &quot;INICIANTE / TREINO 01: / -
          link&quot;. Cada video vira um workout em rascunho. Voce edita
          nome/categoria depois antes de publicar.
        </p>
      </div>

      <BulkImportForm />
    </div>
  );
}
