"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { seedDefaultTemplates } from "../actions";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function SeedTemplatesButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSeed = async () => {
    setLoading(true);
    try {
      const result = await seedDefaultTemplates();
      toast.success(`${result.seeded} templates padrão carregados com sucesso!`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar templates"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSeed}
      disabled={loading}
      className="bg-pink hover:bg-pink/90 text-white"
    >
      <Sparkles size={18} className="mr-2" />
      {loading ? "Carregando..." : "Carregar Templates Padrão"}
    </Button>
  );
}
