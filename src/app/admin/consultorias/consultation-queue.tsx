"use client";

import { useState } from "react";
import { updateConsultationStatus } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings2, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Consultation {
  id: string;
  user_id: string;
  package_type: string;
  status: string;
  valid_until: string;
  created_at: string;
  profiles: { full_name: string };
}

const statusConfig: Record<
  string,
  { label: string; variant: "pink" | "yellow" | "green" | "dark" }
> = {
  pending: { label: "Pendente", variant: "yellow" },
  in_progress: { label: "Em Andamento", variant: "pink" },
  delivered: { label: "Entregue", variant: "green" },
  expired: { label: "Expirada", variant: "dark" },
};

const packageLabels: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  premium: "Premium",
  assessoria: "Assessoria",
};

export function ConsultationQueue({ consultations }: { consultations: Consultation[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? consultations
      : consultations.filter((c) => c.status === filter);

  if (!consultations.length) {
    return (
      <div className="text-center py-16">
        <Settings2 size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhuma consultoria no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs — wrap em telas pequenas */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: "pending", label: "Pendentes" },
          { value: "in_progress", label: "Em Andamento" },
          { value: "delivered", label: "Entregues" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 ${
              filter === tab.value
                ? "bg-pink text-white"
                : "bg-bg-1 text-gray-2 border border-gray-4 hover:border-pink/40"
            }`}
          >
            {tab.label}
            {tab.value !== "all" && (
              <span className="ml-1.5 font-mono text-[11px]">
                {consultations.filter((c) => c.status === tab.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MOBILE (< md): cards verticais — sem scroll horizontal. */}
      <div className="md:hidden space-y-3">
        {filtered.map((c) => {
          const cfg = statusConfig[c.status] || statusConfig.pending;
          return (
            <article
              key={c.id}
              className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold leading-tight truncate">
                    {c.profiles?.full_name || "—"}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="pink" className="text-[10px]">
                      {packageLabels[c.package_type] || c.package_type}
                    </Badge>
                    <Badge variant={cfg.variant} className="text-[10px]">
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-4">
                <span className="flex items-center gap-1 text-[11px] text-gray-3">
                  <Calendar size={12} />
                  Válida até{" "}
                  <span className="font-mono text-gray-2">
                    {new Date(c.valid_until).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  {c.status === "pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateConsultationStatus(c.id, "in_progress")}
                    >
                      Iniciar
                    </Button>
                  )}
                  <Link href={`/admin/consultorias/${c.id}`}>
                    <Button variant="icon" size="icon" className="w-8 h-8">
                      <ChevronRight size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* DESKTOP (>= md): tabela densa preservada. */}
      <div className="hidden md:block bg-bg-1 border border-gray-4 rounded-[14px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-4 hover:bg-transparent">
              <TableHead className="text-gray-2">Assinante</TableHead>
              <TableHead className="text-gray-2">Pacote</TableHead>
              <TableHead className="text-gray-2">Status</TableHead>
              <TableHead className="text-gray-2">Validade</TableHead>
              <TableHead className="text-gray-2 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const cfg = statusConfig[c.status] || statusConfig.pending;
              return (
                <TableRow key={c.id} className="border-gray-4">
                  <TableCell className="text-white font-medium">
                    {c.profiles?.full_name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="pink">
                      {packageLabels[c.package_type] || c.package_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-gray-2">
                    {new Date(c.valid_until).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "pending" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateConsultationStatus(c.id, "in_progress")}
                        >
                          Iniciar
                        </Button>
                      )}
                      <Link href={`/admin/consultorias/${c.id}`}>
                        <Button variant="icon" size="icon" className="w-8 h-8">
                          <ChevronRight size={16} />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
