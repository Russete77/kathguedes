import { getWorkouts } from "../actions";
import { WorkoutList } from "./workout-list";
import { WorkoutForm } from "./workout-form";

export const metadata = { title: "Treinos" };

export default async function AdminTreinosPage() {
  const workouts = await getWorkouts();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">TREINOS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Publique treinos com vídeo do YouTube em 30 segundos.
          </p>
        </div>
        <WorkoutForm />
      </div>

      <WorkoutList workouts={workouts} />
    </div>
  );
}
