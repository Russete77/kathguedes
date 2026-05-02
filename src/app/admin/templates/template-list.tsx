"use client";

import { useState } from "react";
import { deleteTemplate } from "../actions";
import { TemplateEditor } from "./template-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Calendar } from "lucide-react";
import { toast } from "sonner";

interface PlanTemplate {
  id: string;
  name: string;
  description: string | null;
  type: "workout" | "diet";
  data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateListProps {
  templates: PlanTemplate[];
  type: "workout" | "diet";
}

export function TemplateList({ templates, type }: TemplateListProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o template "${name}"?`)) return;

    setLoading(true);
    try {
      await deleteTemplate(id);
      toast.success("Template deletado com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao deletar template"
      );
    } finally {
      setLoading(false);
    }
  };

  const getItemCount = (template: PlanTemplate) => {
    if (type === "workout") {
      const data = template.data as { weeks?: Array<{ days?: unknown[] }> };
      return (data.weeks?.[0]?.days?.length ?? 0);
    } else {
      const data = template.data as { meals?: unknown[] };
      return data.meals?.length ?? 0;
    }
  };

  if (!templates.length) {
    return (
      <div className="text-center py-12 bg-bg-1 border border-gray-4 rounded-[14px]">
        <Calendar size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">
          Nenhum template de {type === "workout" ? "treino" : "dieta"} cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const itemCount = getItemCount(template);
        const formattedDate = new Date(template.created_at).toLocaleDateString("pt-BR");

        return (
          <div
            key={template.id}
            className="bg-bg-1 border border-gray-4 rounded-[14px] p-5 flex items-start justify-between hover:border-gray-3 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-base truncate">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-gray-2 text-sm mt-1 line-clamp-2">
                  {template.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="white">
                  {itemCount}{" "}
                  {type === "workout"
                    ? itemCount === 1
                      ? "dia"
                      : "dias"
                    : itemCount === 1
                      ? "refeição"
                      : "refeições"}
                </Badge>
                <span className="text-gray-3 text-xs">{formattedDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4 shrink-0">
              <TemplateEditor template={template}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-2 hover:text-pink hover:bg-bg-2"
                >
                  <Edit size={18} strokeWidth={1.6} />
                </Button>
              </TemplateEditor>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(template.id, template.name)}
                disabled={loading}
                className="text-gray-2 hover:text-red-500 hover:bg-bg-2"
              >
                <Trash2 size={18} strokeWidth={1.6} />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
