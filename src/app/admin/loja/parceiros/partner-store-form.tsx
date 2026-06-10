"use client";

import { useState, type ReactNode } from "react";
import { createPartnerStore, updatePartnerStore } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface PartnerStore {
  id: string;
  name: string;
  whatsapp_number: string;
  logo_url: string | null;
}

interface PartnerStoreFormProps {
  store?: PartnerStore;
  children?: ReactNode;
}

export function PartnerStoreForm({ store, children }: PartnerStoreFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!store;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (isEditing) {
        await updatePartnerStore(store.id, formData);
        toast.success("Loja parceira atualizada!");
      } else {
        await createPartnerStore(formData);
        toast.success("Loja parceira criada!");
      }
      setOpen(false);
    } catch (err) {
      toast.error(isEditing ? "Erro ao atualizar loja" : "Erro ao criar loja");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!children ? (
        <DialogTrigger className="inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-5 py-2 bg-pink text-white rounded-full shadow-pink hover:bg-pink-light transition-all duration-200 cursor-pointer">
          <Plus size={16} />
          Nova Loja Parceira
        </DialogTrigger>
      ) : (
        <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      )}
      <DialogContent className="bg-bg-1 border-gray-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            {isEditing ? "EDITAR PARCEIRO" : "NOVO PARCEIRO"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="name"
            label="Nome da loja"
            placeholder="Ex: Loja Fitness Brasil"
            defaultValue={store?.name}
            required
          />
          <div>
            <Input
              name="whatsapp_number"
              label="Número WhatsApp"
              placeholder="5511999999999"
              defaultValue={store?.whatsapp_number}
              required
            />
            <p className="text-xs text-gray-3 mt-1">
              DDI + DDD + número, somente dígitos. Ex: 5511999999999
            </p>
          </div>
          <Input
            name="logo_url"
            label="Logo URL (opcional)"
            placeholder="https://..."
            defaultValue={store?.logo_url ?? ""}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading
                ? (isEditing ? "Salvando..." : "Criando...")
                : (isEditing ? "Salvar" : "Criar Parceiro")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
