import { PushForm } from "./push-form";

export const metadata = { title: "Push Notifications" };

export default function AdminPushPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">
          PUSH <span className="text-pink">NOTIFICATIONS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Envie notificações para todos os assinantes ou por segmento.
        </p>
      </div>
      <PushForm />
    </div>
  );
}
