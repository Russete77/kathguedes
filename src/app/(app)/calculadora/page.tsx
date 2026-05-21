import type { Metadata } from "next";
import { MacroCalculator } from "./macro-calculator";

export const metadata: Metadata = {
  title: "Calculadora de Macros",
  description: "Calcule suas calorias e macronutrientes ideais (proteína, carboidrato, gordura) com o método da Kath Guedes. Resultado em segundos, grátis.",
  keywords: ["calculadora de macros", "calorias diárias", "macronutrientes", "dieta fitness", "TDEE"],
  alternates: { canonical: "https://kathapp.com.br/calculadora" },
  openGraph: {
    title: "Calculadora de Macros Grátis — KathApp",
    description: "Descubra suas calorias e macros ideais. Método da Kath Guedes, resultado em segundos.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function CalculadoraPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl lg:text-5xl text-white">
          CALCULADORA DE <span className="text-pink">MACROS</span>
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Descubra suas calorias e macros ideais baseado no método da Kath.
          Insira seus dados e receba uma estimativa personalizada.
        </p>
      </div>

      <MacroCalculator />
    </div>
  );
}
