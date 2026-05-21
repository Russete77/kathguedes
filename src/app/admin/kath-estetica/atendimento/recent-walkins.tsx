import { formatPlate } from "@/lib/estetica/plates";
import { formatPrice, formatDateTime } from "@/lib/estetica/types";

interface RecentItem {
  id: string;
  plate: string;
  customer_name: string;
  service_title: string | null;
  price_cents: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  transferencia: "Transferência",
  outro: "Outro",
};

const STATUS_BADGE: Record<string, string> = {
  in_progress: "bg-pink/15 text-pink border-pink/30",
  done: "bg-green-500/15 text-green-300 border-green-500/30",
  canceled: "bg-gray-4/40 text-gray-2 border-gray-4",
};

const PAYMENT_BADGE: Record<string, string> = {
  pago: "bg-green-500/15 text-green-300 border-green-500/30",
  pendente: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  isento: "bg-gray-4/40 text-gray-2 border-gray-4",
};

export function RecentWalkins({ items }: { items: RecentItem[] }) {
  return (
    <aside className="bg-bg-1 border border-gray-4 rounded-[22px] p-5 space-y-4 sticky top-4">
      <div>
        <h2 className="font-display text-xl text-white">ÚLTIMOS ATENDIMENTOS</h2>
        <p className="text-gray-2 text-xs mt-1">
          {items.length === 0
            ? "Nenhum atendimento registrado ainda."
            : `${items.length} mais recente${items.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {items.map((w) => (
            <li
              key={w.id}
              className="border border-gray-4 rounded-[14px] p-3 bg-bg-base/40 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-white tracking-wider">
                  {formatPlate(w.plate)}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${STATUS_BADGE[w.status] ?? STATUS_BADGE.in_progress}`}
                >
                  {w.status === "in_progress"
                    ? "Em atendimento"
                    : w.status === "done"
                      ? "Concluído"
                      : "Cancelado"}
                </span>
              </div>
              <div className="text-xs text-gray-2 truncate">{w.customer_name}</div>
              <div className="text-xs text-gray-3 truncate">
                {w.service_title ?? "Sem serviço vinculado"}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-sm text-white font-medium">
                  {formatPrice(w.price_cents)}
                </span>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${PAYMENT_BADGE[w.payment_status] ?? PAYMENT_BADGE.pago}`}
                  >
                    {w.payment_status}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider border border-gray-4 text-gray-2 rounded-full px-2 py-0.5">
                    {PAYMENT_LABEL[w.payment_method] ?? w.payment_method}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-gray-3">{formatDateTime(w.created_at)}</div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
