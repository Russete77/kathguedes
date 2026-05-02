import { getTemplates } from "../actions";
import { TemplateList } from "./template-list";
import { TemplateEditor } from "./template-editor";
import { SeedButton } from "./seed-button";

export const metadata = { title: "Templates" };

export default async function AdminTemplatesPage() {
  const [workoutTemplatesData, dietTemplatesData] = await Promise.all([
    getTemplates("workout"),
    getTemplates("diet"),
  ]);

  const workoutTemplates = (workoutTemplatesData || []) as unknown as any[];
  const dietTemplates = (dietTemplatesData || []) as unknown as any[];

  const isEmpty = workoutTemplates.length === 0 && dietTemplates.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">TEMPLATES</h1>
          <p className="text-gray-2 text-sm mt-1">
            Gerencie templates de treino e dieta para seus alunos.
          </p>
        </div>
        <TemplateEditor />
      </div>

      {isEmpty && (
        <div className="text-center py-12 bg-bg-1 border border-gray-4 rounded-[14px] space-y-4">
          <p className="text-gray-2">
            Nenhum template cadastrado ainda. Deseja carregar os templates padrão?
          </p>
          <SeedButton />
        </div>
      )}

      {!isEmpty && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl text-white mb-4">Templates de Treino</h2>
            <TemplateList templates={workoutTemplates} type="workout" />
          </div>

          <div>
            <h2 className="font-display text-xl text-white mb-4">Templates de Dieta</h2>
            <TemplateList templates={dietTemplates} type="diet" />
          </div>
        </div>
      )}
    </div>
  );
}
