import Image from "next/image";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Bem-vinda ao KathApp" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/icons/logo-200.png"
            alt="KathApp"
            width={80}
            height={80}
            className="rounded-2xl mx-auto mb-4"
          />
          <h1 className="font-display text-5xl text-white">
            BEM-VINDA AO
            <br />
            <span className="text-pink">KATHAPP</span>
          </h1>
          <p className="text-gray-2 text-[15px] mt-3">
            Conta pra gente um pouco sobre você pra personalizarmos sua
            experiência.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
