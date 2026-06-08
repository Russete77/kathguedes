"use client";

import { useState } from "react";
import { createConsultation } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
  plan_tier: string;
}

export function ConsultationForm({ profiles }: { profiles: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createConsultation(formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer">
        <Plus size={16} />
        Nova Consultoria
      </DialogTrigger>
      <DialogContent className="bg-bg-1 border-gray-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            CRIAR CONSULTORIA
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
              Assinante
            </label>
            <Select name="user_id" required>
              <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                <SelectValue placeholder="Selecione o assinante" />
              </SelectTrigger>
              <SelectContent className="bg-bg-2 border-gray-4">
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} ({p.plan_tier.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
              Pacote
            </label>
            <Select name="package_type" required>
              <SelectTrigger className="bg-bg-1 border-gray-4 text-white">
                <SelectValue placeholder="Tipo de pacote" />
              </SelectTrigger>
              <SelectContent className="bg-bg-2 border-gray-4">
                <SelectItem value="mensal">Mensal (30 dias)</SelectItem>
                <SelectItem value="trimestral">Trimestral (90 dias)</SelectItem>
                <SelectItem value="premium">Premium (90 dias + check-in)</SelectItem>
                <SelectItem value="assessoria">Assessoria Completa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input name="days_valid" label="Dias de validade" type="number" placeholder="30" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Criando..." : "Criar Consultoria"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
