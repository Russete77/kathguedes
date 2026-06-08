import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getReviewQueue } from "./actions";
import { ReviewInbox } from "./review-inbox";

export const metadata = { title: "Fila de revisão" };
export const dynamic = "force-dynamic";

export default async function ReviewInboxPage() {
  const items = await getReviewQueue();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/consultorias"
        className="inline-flex items-center gap-2 text-gray-2 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        Voltar para consultorias
      </Link>

      <div>
        <h1 className="font-display text-4xl text-white">FILA DE REVISÃO</h1>
        <p className="text-gray-2 text-sm mt-1">
          Consultorias aguardando você. Abra para revisar o rascunho da IA, ajuste e
          entregue — ou aprove em lote as que já estão prontas.
        </p>
      </div>

      <ReviewInbox items={items} />
    </div>
  );
}
