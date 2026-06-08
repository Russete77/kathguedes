import Link from "next/link";
import { SlidersHorizontal, Inbox } from "lucide-react";
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
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/consultorias/inbox"
            className="inline-flex items-center gap-2 text-sm text-gray-2 hover:text-pink transition-colors"
          >
            <Inbox size={16} />
            Fila de revisão
          </Link>
          <Link
            href="/admin/consultorias/splits"
            className="inline-flex items-center gap-2 text-sm text-gray-2 hover:text-pink transition-colors"
          >
            <SlidersHorizontal size={16} />
            Splits por frequência
          </Link>
          <ConsultationForm profiles={profiles} />
        </div>
      </div>

      <ConsultationQueue consultations={consultations} />
    </div>
  );
}
