import { getConsultations, getProfilesList } from "../actions";
import { ConsultationQueue } from "./consultation-queue";
import { ConsultationForm } from "./consultation-form";

export const metadata = { title: "Consultorias" };

export default async function AdminConsultoriasPage() {
  const [consultations, profiles] = await Promise.all([
    getConsultations(),
    getProfilesList(),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">CONSULTORIAS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Gerencie consultorias — monte treinos e dietas direto no app.
          </p>
        </div>
        <ConsultationForm profiles={profiles} />
      </div>

      <ConsultationQueue consultations={consultations} />
    </div>
  );
}
