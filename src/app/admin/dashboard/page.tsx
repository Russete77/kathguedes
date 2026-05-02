import { getDashboardMetrics } from "../actions";
import Link from "next/link";
import {
  Users,
  PlayCircle,
  Tag,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MessageCircle,
  ClipboardList,
  AlertTriangle,
  Package,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  BarChart2,
} from "lucide-react";

export const metadata = { title: "Admin Dashboard" };

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default async function AdminDashboardPage() {
  const m = await getDashboardMetrics();

  const paidUsers = m.planCounts.start + m.planCounts.pro + m.planCounts.vip;
  const conversionRate = m.totalSubscribers > 0
    ? ((paidUsers / m.totalSubscribers) * 100).toFixed(1)
    : "0";

  const hasAlerts = m.consultations.pending > 0 || m.unreadMessages > 0 || m.lowStockProducts.length > 0 || m.orders.pending > 0 || m.expiredCoupons > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-display text-5xl text-white">
          PAINEL <span className="text-pink">ADMIN</span>
        </h1>
        <p className="text-gray-2 text-base mt-2">Visão geral completa do KathApp.</p>
      </div>

      {/* ── ALERTAS OPERACIONAIS ── */}
      {hasAlerts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {m.consultations.pending > 0 && (
            <Link href="/admin/consultorias" className="flex items-center gap-4 bg-yellow-500/10 border border-yellow-500/30 rounded-[14px] p-5 hover:border-yellow-500/60 transition-all">
              <ClipboardList size={24} className="stroke-yellow-400 shrink-0" />
              <div>
                <div className="text-white font-semibold text-base">{m.consultations.pending} consultoria{m.consultations.pending > 1 ? "s" : ""}</div>
                <div className="text-yellow-400/70 text-sm">aguardando resposta</div>
              </div>
            </Link>
          )}
          {m.unreadMessages > 0 && (
            <Link href="/admin/chat" className="flex items-center gap-4 bg-pink/10 border border-pink/30 rounded-[14px] p-5 hover:border-pink/60 transition-all">
              <MessageCircle size={24} className="stroke-pink shrink-0" />
              <div>
                <div className="text-white font-semibold text-base">{m.unreadMessages} mensagen{m.unreadMessages > 1 ? "s" : ""}</div>
                <div className="text-pink/70 text-sm">VIP não lidas</div>
              </div>
            </Link>
          )}
          {m.orders.pending > 0 && (
            <Link href="/admin/loja" className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/30 rounded-[14px] p-5 hover:border-blue-500/60 transition-all">
              <Package size={24} className="stroke-blue-400 shrink-0" />
              <div>
                <div className="text-white font-semibold text-base">{m.orders.pending} pedido{m.orders.pending > 1 ? "s" : ""}</div>
                <div className="text-blue-400/70 text-sm">pendentes</div>
              </div>
            </Link>
          )}
          {m.lowStockProducts.length > 0 && (
            <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/30 rounded-[14px] p-5">
              <AlertTriangle size={24} className="stroke-red-400 shrink-0" />
              <div>
                <div className="text-white font-semibold text-base">{m.lowStockProducts.length} produto{m.lowStockProducts.length > 1 ? "s" : ""}</div>
                <div className="text-red-400/70 text-sm">estoque baixo (&le;5)</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECEITA ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<DollarSign size={26} className="stroke-green-400" />}
          label="Receita Total"
          value={formatBRL(m.revenueTotalCents)}
        />
        <StatCard
          icon={<DollarSign size={26} className="stroke-green-400" />}
          label="Receita (30 dias)"
          value={formatBRL(m.revenueMonthCents)}
        />
        <StatCard
          icon={<BarChart2 size={26} className="stroke-pink" />}
          label="Conversão Free → Pago"
          value={`${conversionRate}%`}
          sub={`${paidUsers} pagantes de ${m.totalSubscribers}`}
        />
      </div>

      {/* ── USUÁRIOS ── */}
      <div>
        <SectionTitle>Usuários</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users size={26} className="stroke-pink" />}
            label="Total Usuários"
            value={m.totalSubscribers}
          />
          <StatCard
            icon={<UserPlus size={26} className="stroke-cyan-400" />}
            label="Novos (7 dias)"
            value={m.signupsThisWeek}
            trend={m.growthPct}
            sub={`semana anterior: ${m.signupsLastWeek}`}
          />
          <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6 col-span-2">
            <div className="text-sm font-semibold text-gray-2 uppercase tracking-wider mb-4">Distribuição de Planos</div>
            <div className="flex gap-3 mb-4">
              {[
                { label: "Free", count: m.planCounts.free, color: "bg-gray-2" },
                { label: "Start", count: m.planCounts.start, color: "bg-cyan-400" },
                { label: "Pro", count: m.planCounts.pro, color: "bg-pink" },
                { label: "VIP", count: m.planCounts.vip, color: "bg-yellow-400" },
              ].map((p) => (
                <div key={p.label} className="flex-1 text-center">
                  <div className="font-display text-3xl text-white">{p.count}</div>
                  <div className="text-sm text-gray-3 mt-1">{p.label}</div>
                </div>
              ))}
            </div>
            {/* Bar chart */}
            <div className="flex h-4 rounded-full overflow-hidden bg-bg-2">
              {m.totalSubscribers > 0 && (
                <>
                  <div className="bg-gray-2 transition-all" style={{ width: `${(m.planCounts.free / m.totalSubscribers) * 100}%` }} />
                  <div className="bg-cyan-400 transition-all" style={{ width: `${(m.planCounts.start / m.totalSubscribers) * 100}%` }} />
                  <div className="bg-pink transition-all" style={{ width: `${(m.planCounts.pro / m.totalSubscribers) * 100}%` }} />
                  <div className="bg-yellow-400 transition-all" style={{ width: `${(m.planCounts.vip / m.totalSubscribers) * 100}%` }} />
                </>
              )}
            </div>
            {/* Subscription health */}
            <div className="flex gap-5 mt-4 text-sm">
              <span className="text-green-400">● {m.subscriptionStatus.active} ativos</span>
              <span className="text-yellow-400">● {m.subscriptionStatus.pastDue} inadimplentes</span>
              <span className="text-red-400">● {m.subscriptionStatus.canceled} cancelados</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONSULTORIAS & PEDIDOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consultorias */}
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList size={22} className="stroke-pink" />
            <span className="font-semibold text-sm text-gray-2 uppercase tracking-wider">Consultorias</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat icon={<Clock size={20} className="stroke-yellow-400" />} value={m.consultations.pending} label="Pendentes" />
            <MiniStat icon={<PlayCircle size={20} className="stroke-cyan-400" />} value={m.consultations.inProgress} label="Em andamento" />
            <MiniStat icon={<CheckCircle2 size={20} className="stroke-green-400" />} value={m.consultations.delivered} label="Entregues" />
          </div>
        </div>

        {/* Pedidos da Loja */}
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Package size={22} className="stroke-pink" />
            <span className="font-semibold text-sm text-gray-2 uppercase tracking-wider">Pedidos da Loja</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat icon={<Clock size={20} className="stroke-yellow-400" />} value={m.orders.pending} label="Pendentes" />
            <MiniStat icon={<DollarSign size={20} className="stroke-green-400" />} value={m.orders.paid} label="Pagos" />
            <MiniStat icon={<Truck size={20} className="stroke-cyan-400" />} value={m.orders.shipped} label="Enviados" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <MiniStat icon={<CheckCircle2 size={20} className="stroke-green-400" />} value={m.orders.delivered} label="Entregues" />
            <MiniStat icon={<XCircle size={20} className="stroke-red-400" />} value={m.orders.canceled} label="Cancelados" />
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div>
        <SectionTitle>Conteúdo</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<PlayCircle size={26} className="stroke-pink" />}
            label="Treinos"
            value={m.publishedWorkouts}
            sub={`${m.totalWorkouts} total / ${m.totalWorkouts - m.publishedWorkouts} rascunho`}
          />
          <StatCard
            icon={<Tag size={26} className="stroke-cyan-400" />}
            label="Cupons Ativos"
            value={m.activeCoupons}
            sub={m.expiredCoupons > 0 ? `${m.expiredCoupons} expirados` : undefined}
          />
          <StatCard
            icon={<MessageCircle size={26} className="stroke-yellow-400" />}
            label="Chat VIP"
            value={m.unreadMessages}
            sub="não lidas"
          />
          <StatCard
            icon={<ShoppingBag size={26} className="stroke-green-400" />}
            label="Afiliados"
            value={m.topAffiliates.length}
            sub="links ativos"
          />
        </div>
      </div>

      {/* ── RANKINGS ── */}
      <div>
        <SectionTitle>Rankings</SectionTitle>
        <div className="grid lg:grid-cols-3 gap-6">
          <RankingCard
            title="TREINOS MAIS VISTOS"
            icon={<PlayCircle size={22} className="stroke-pink" />}
            items={m.topWorkouts.map((w: { title: string; views_count: number }) => ({
              name: w.title,
              value: `${w.views_count} views`,
            }))}
          />
          <RankingCard
            title="CUPONS MAIS USADOS"
            icon={<Tag size={22} className="stroke-cyan-400" />}
            items={m.topCoupons.map((c: { code: string; uses_count: number }) => ({
              name: c.code,
              value: `${c.uses_count} usos`,
            }))}
          />
          <RankingCard
            title="AFILIADOS TOP CLIQUES"
            icon={<ShoppingBag size={22} className="stroke-green-400" />}
            items={m.topAffiliates.map((a: { title: string; clicks_count: number }) => ({
              name: a.title,
              value: `${a.clicks_count} cliques`,
            }))}
          />
        </div>
      </div>

      {/* ── ESTOQUE BAIXO & SIGNUPS RECENTES ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle size={22} className="stroke-red-400" />
            <span className="font-semibold text-sm text-gray-2 uppercase tracking-wider">Estoque Baixo</span>
          </div>
          {m.lowStockProducts.length === 0 ? (
            <p className="text-gray-3 text-base">Nenhum produto com estoque baixo.</p>
          ) : (
            <div className="space-y-4">
              {m.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-base text-gray-1 truncate mr-3">{p.title}</span>
                  <span className={`font-mono text-sm font-semibold shrink-0 ${p.stock === 0 ? "text-red-400" : "text-yellow-400"}`}>
                    {p.stock === 0 ? "ESGOTADO" : `${p.stock} un.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus size={22} className="stroke-cyan-400" />
            <span className="font-semibold text-sm text-gray-2 uppercase tracking-wider">Cadastros Recentes</span>
          </div>
          {m.recentSignups.length === 0 ? (
            <p className="text-gray-3 text-base">Nenhum cadastro ainda.</p>
          ) : (
            <div className="space-y-4">
              {m.recentSignups.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base text-gray-1 truncate">{u.full_name}</span>
                    <PlanBadge tier={u.plan_tier} />
                  </div>
                  <span className="font-mono text-sm text-gray-3 shrink-0">{timeAgo(u.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ──

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-semibold text-sm text-gray-3 uppercase tracking-[0.15em] mb-5">{children}</h2>
  );
}

function StatCard({
  icon,
  value,
  label,
  sub,
  trend,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub?: string;
  trend?: number;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6 transition-all hover:border-pink/35">
      <div className="flex items-center justify-between mb-4">
        {icon}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {trend >= 0 ? "+" : ""}{trend}%
          </div>
        )}
      </div>
      <div className="font-display text-4xl leading-none text-white">{value}</div>
      <div className="text-base text-gray-2 mt-2">{label}</div>
      {sub && <div className="font-mono text-sm text-gray-3 mt-1">{sub}</div>}
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-bg-2 rounded-[12px] p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="font-display text-2xl text-white">{value}</div>
      <div className="text-sm text-gray-3 mt-1">{label}</div>
    </div>
  );
}

function RankingCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; value: string }[];
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-6">
      <div className="flex items-center gap-2 mb-5">
        {icon}
        <span className="font-semibold text-sm text-gray-2 uppercase tracking-wider">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-3 text-base">Sem dados ainda.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm text-gray-3 w-5">{i + 1}.</span>
                <span className="text-base text-gray-1 truncate">{item.name}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-pink shrink-0 ml-3">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-4 text-gray-2",
    start: "bg-cyan-400/20 text-cyan-400",
    pro: "bg-pink/20 text-pink",
    vip: "bg-yellow-400/20 text-yellow-400",
  };
  return (
    <span className={`text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded ${colors[tier] || colors.free}`}>
      {tier}
    </span>
  );
}
