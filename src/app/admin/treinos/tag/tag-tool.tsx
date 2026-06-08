"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKOUT_CATEGORIES, workoutCategoryLabel } from "@/constants/categories";
import { bulkTagWorkouts } from "../../actions";

export interface TagVideo {
  id: string;
  title: string;
  category: string;
  level: string;
  youtube_id: string;
  is_published: boolean;
  block: number | null;
  week_in_block: number | null;
  split_slot: string | null;
  track: string | null;
}

export function TagTool({ videos }: { videos: TagVideo[] }) {
  const router = useRouter();
  const [cat, setCat] = useState<string>("all");
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Campos de aplicação em lote (vazio = não altera)
  const [track, setTrack] = useState("");
  const [block, setBlock] = useState("");
  const [week, setWeek] = useState("");
  const [slot, setSlot] = useState("");

  const filtered = useMemo(
    () =>
      videos
        .filter((v) => {
          if (cat !== "all" && v.category !== cat) return false;
          if (onlyUntagged && (v.block != null || v.split_slot || v.track)) return false;
          return true;
        })
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    [videos, cat, onlyUntagged],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id)),
    );
  }

  async function handleApply() {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um vídeo.");
      return;
    }
    const patch: {
      ids: string[];
      track?: string;
      block?: number;
      week_in_block?: number;
      split_slot?: string;
    } = { ids: Array.from(selected) };
    if (track.trim()) patch.track = track.trim();
    if (block.trim()) patch.block = Number(block);
    if (week.trim()) patch.week_in_block = Number(week);
    if (slot.trim()) patch.split_slot = slot.trim();

    if (Object.keys(patch).length === 1) {
      toast.error("Preencha ao menos um campo de periodização para aplicar.");
      return;
    }

    setBusy(true);
    try {
      const r = await bulkTagWorkouts(patch);
      toast.success(`Periodização aplicada a ${r.updated} vídeo(s).`, {
        style: { borderLeft: "3px solid #00FF88" },
      });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
            Categoria
          </label>
          <Select value={cat} onValueChange={(v) => setCat(String(v))}>
            <SelectTrigger className="bg-bg-1 border-gray-4 text-white w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-bg-2 border-gray-4">
              <SelectItem value="all">Todas as categorias</SelectItem>
              {WORKOUT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gray-1 bg-bg-1 border border-gray-4 rounded-[8px] px-4 py-3">
          <input
            type="checkbox"
            checked={onlyUntagged}
            onChange={(e) => setOnlyUntagged(e.target.checked)}
            className="accent-pink"
          />
          Só sem periodização
        </label>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-gray-2 hover:text-pink transition-colors px-2 py-3"
        >
          {selected.size === filtered.length && filtered.length > 0
            ? "Limpar seleção"
            : "Selecionar todos"}
        </button>
      </div>

      {/* Barra de aplicação em lote */}
      <div className="bg-bg-1 border border-pink/30 rounded-[14px] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Tag size={16} className="stroke-pink" />
          <span className="text-white font-semibold text-sm">
            Aplicar a {selected.size} selecionado(s)
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Input label="Trilha" value={track} onChange={(e) => setTrack(e.target.value)} placeholder="ex: iniciante" />
          <Input label="Bloco" type="number" min={1} value={block} onChange={(e) => setBlock(e.target.value)} placeholder="ex: 1" />
          <Input label="Semana (1-6)" type="number" min={1} max={6} value={week} onChange={(e) => setWeek(e.target.value)} placeholder="1 a 6" />
          <Input label="Slot do split" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="ex: gluteo" />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleApply} disabled={busy || selected.size === 0}>
            {busy ? <Loader2 size={16} className="animate-spin mr-1" /> : <Tag size={16} className="mr-1" />}
            Aplicar periodização
          </Button>
        </div>
        <p className="text-gray-3 text-[11px]">
          Campos em branco não são alterados. Preencha só o que quer aplicar.
        </p>
      </div>

      {/* Lista */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] divide-y divide-gray-4/40">
        {filtered.length === 0 ? (
          <p className="text-gray-3 text-sm text-center py-10">Nenhum vídeo com esse filtro.</p>
        ) : (
          filtered.map((v) => {
            const isSel = selected.has(v.id);
            return (
              <label
                key={v.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isSel ? "bg-pink-dim" : "hover:bg-bg-2"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(v.id)}
                  className="accent-pink shrink-0"
                />
                <div
                  className="w-16 h-10 rounded-[6px] bg-bg-2 bg-cover bg-center shrink-0 border border-gray-4"
                  style={{
                    backgroundImage: `url(https://img.youtube.com/vi/${v.youtube_id.replace("short:", "")}/mqdefault.jpg)`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[14px] font-medium truncate">{v.title}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="dark" className="text-[10px]">
                      {workoutCategoryLabel(v.category)}
                    </Badge>
                    {!v.is_published && (
                      <Badge variant="yellow" className="text-[10px]">Rascunho</Badge>
                    )}
                    {v.track && <Badge variant="white" className="text-[10px]">{v.track}</Badge>}
                    {v.block != null && (
                      <Badge variant="pink" className="text-[10px]">
                        B{v.block}{v.week_in_block ? `·S${v.week_in_block}` : ""}
                      </Badge>
                    )}
                    {v.split_slot && (
                      <Badge variant="green" className="text-[10px]">{v.split_slot}</Badge>
                    )}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
