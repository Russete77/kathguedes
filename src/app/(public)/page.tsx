import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActivePlans, type Plan, type PlanFeatures } from "@/lib/billing/plans";
import {
  PlayCircle,
  Target,
  Calculator,
  Tag,
  ShoppingBag,
  MessageCircle,
  Flame,
  Bike,
  Zap,
  ArrowRight,
  ArrowDown,
  Check,
  Star,
  Crown,
  Dumbbell,
  Heart,
  Sparkles,
  ChevronRight,
} from "lucide-react";

// Brand icons (removed from lucide-react v1.x)
const Instagram = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);
const Youtube = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

import { LandingShell } from "./landing-shell";

export const metadata: Metadata = {
  title: "KathApp — Fitness, Estética Moto e Lifestyle | Kath Guedes",
  description:
    "O app da Kath Guedes: treinos em vídeo, consultoria fitness personalizada, loja de suplementos, cupons exclusivos e Kath Guedes Estética Moto — agende lavagem, polimento, vitrificação e higienização da sua moto direto pelo app. Programa de fidelidade: 4 lavagens = 5ª grátis.",
  keywords: [
    "kath guedes",
    "app de treino",
    "kath guedes estética moto",
    "estética para motos",
    "lavagem de moto",
    "polimento de moto",
    "vitrificação moto",
    "consultoria fitness",
    "treino online feminino",
    "treino de glúteos",
    "dieta personalizada",
    "calculadora de macros",
  ],
  alternates: { canonical: "https://kathapp.com.br" },
  openGraph: {
    title: "KathApp — Treinos em Vídeo, Consultoria Fitness e Loja",
    description: "Treinos em vídeo exclusivos, consultoria de treino e dieta personalizada, calculadora de macros, loja fitness e cupons. O app da Kath Guedes. Comece grátis.",
    url: "https://kathapp.com.br",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "KathApp — App fitness da Kath Guedes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KathApp — Treinos, Consultoria Fitness e Loja",
    description: "Treinos em vídeo, consultoria personalizada, calculadora de macros e loja fitness. O app da Kath Guedes.",
    images: ["/og-image.png"],
  },
};

// Re-fetch a cada request — preço/planos podem mudar via admin.
export const dynamic = "force-dynamic";

function buildJsonLd(plans: Plan[]) {
  const paid = plans.filter((p) => p.is_active && p.asaas_value > 0);
  const planOffers = plans
    .filter((p) => p.is_active)
    .map((p) => ({
      "@type": "Offer",
      price: (p.price_cents / 100).toFixed(2),
      priceCurrency: "BRL",
      name: p.name,
      description: p.asaas_description || `Plano ${p.name}`,
    }));

  const planSummary = paid
    .map((p) => `${p.name} (${(p.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês)`)
    .join(", ");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://kathapp.com.br/#organization",
        name: "KathApp",
        url: "https://kathapp.com.br",
        logo: { "@type": "ImageObject", url: "https://kathapp.com.br/icons/icon-512.png", width: 512, height: 512 },
        description:
          "App fitness da Kath Guedes com treinos em vídeo, consultoria personalizada de treino e dieta, loja de suplementos e cupons exclusivos.",
        sameAs: ["https://www.instagram.com/kathguedes", "https://www.youtube.com/@kathguedes", "https://www.tiktok.com/@kathguedes"],
      },
      {
        "@type": "WebSite",
        "@id": "https://kathapp.com.br/#website",
        url: "https://kathapp.com.br",
        name: "KathApp",
        publisher: { "@id": "https://kathapp.com.br/#organization" },
        inLanguage: "pt-BR",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://kathapp.com.br/#app",
        name: "KathApp",
        operatingSystem: "Web",
        applicationCategory: "HealthApplication",
        offers: planOffers,
        author: { "@id": "https://kathapp.com.br/#organization" },
        description:
          "App de fitness com treinos em vídeo, consultoria personalizada de treino e dieta, loja de suplementos e cupons exclusivos.",
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "O KathApp é gratuito?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Sim! O plano Free oferece treinos preview gratuitos. Para acesso completo, escolha entre: ${planSummary || "planos pagos disponíveis no app"}.`,
            },
          },
          {
            "@type": "Question",
            name: "O que inclui a consultoria personalizada?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Os planos com consultoria incluem plano de treino e dieta personalizados montados pela Kath, dentro do próprio app. Tudo renderizado nativamente — sem PDFs.",
            },
          },
          {
            "@type": "Question",
            name: "Quais tipos de treino estão disponíveis?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "O KathApp tem uma biblioteca completa de treinos em vídeo gravados pela Kath: glúteos, pernas, membros superiores, HIIT e corpo todo. Novos treinos são adicionados toda semana para assinantes.",
            },
          },
        ],
      },
    ],
  };
}

export default async function Home() {
  const plans = await getActivePlans();
  const jsonLd = buildJsonLd(plans);

  return (
    <LandingShell>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <NavBar />
      <HeroSection />
      <MarqueeSection />
      <SocialProofSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection plans={plans} />
      <KathEsteticaSection />
      <CtaSection />
      <FaqSection />
      <FooterSection />
    </LandingShell>
  );
}

/* ════════════════════════════════════════════════════
   SECTION COMPONENTS
   ════════════════════════════════════════════════════ */

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-base/60 backdrop-blur-2xl border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/icons/logo-navbar.png" alt="KathApp" width={36} height={36} className="rounded-xl" priority />
          <span className="font-display text-xl text-white tracking-wider hidden sm:block">KATHAPP</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="https://instagram.com/kathguedes" target="_blank" className="p-2 text-gray-3 hover:text-pink transition-colors">
            <Instagram size={18} />
          </Link>
          <Link href="https://youtube.com/@kathguedes" target="_blank" className="p-2 text-gray-3 hover:text-pink transition-colors">
            <Youtube size={18} />
          </Link>
          <div className="w-px h-6 bg-gray-4 mx-2" />
          <Link href="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link href="/registro"><Button size="sm">Assinar</Button></Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Neon spots (hape.io style — large, blurred, drifting) */}
      <div className="neon-spot neon-spot-pink w-[800px] h-[800px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30" style={{ animation: "neon-drift 12s ease-in-out infinite" }} />
      <div className="neon-spot neon-spot-purple w-[500px] h-[500px] top-[15%] right-[5%] opacity-15" style={{ animation: "neon-drift 16s ease-in-out infinite reverse" }} />
      <div className="neon-spot neon-spot-pink w-[300px] h-[300px] bottom-[20%] left-[10%] opacity-10" style={{ animation: "neon-drift 10s ease-in-out infinite 2s" }} />

      {/* Hero video */}
      <div className="absolute inset-0 z-[1] overflow-hidden flex items-center justify-center">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          style={{ objectPosition: "center 25%" }}
        >
          <source src="/images/kath-walk.mp4" type="video/mp4" />
        </video>
      </div>
      {/* Gradient overlays */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-bg-base/60 via-transparent to-bg-base" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">


        {/* Hero title — 3D rotate reveal (hape.io) */}
        <div className="mb-8">
          <div className="overflow-hidden">
            <h1
              className="font-display text-[56px] sm:text-[80px] lg:text-[120px] xl:text-[150px] leading-[0.82] text-white tracking-tight"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.6s both" }}
            >
              CANSOU DE
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="font-display text-[56px] sm:text-[80px] lg:text-[120px] xl:text-[150px] leading-[0.82] text-gradient-pink"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.75s both" }}
            >
              ENROLAÇÃO?
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="font-display text-[56px] sm:text-[80px] lg:text-[120px] xl:text-[150px] leading-[0.82] text-white"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.9s both" }}
            >
              TREINA COMIGO.
            </h1>
          </div>
        </div>

        {/* Subtitle — fade up */}
        <div style={{ animation: "fade-y-in 0.9s cubic-bezier(0.165, 0.84, 0.44, 1) 1.2s both" }}>
          <p className="font-body text-lg sm:text-xl text-gray-2 max-w-2xl mx-auto mb-10 leading-relaxed">
            Enquanto você procura desculpa, outras já estão mudando o shape.
            Treinos em vídeo, consultoria e dieta — tudo num único app. A decisão é sua.
          </p>
        </div>

        {/* CTAs — scale in */}
        <div style={{ animation: "fade-y-in 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) 1.5s both" }}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/registro">
              <Button size="xl" className="group">
                Quero Começar
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="xl">Já tenho conta</Button>
            </Link>
          </div>
          <p className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase">
            Começa grátis · Sem cartão · Sem desculpa
          </p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" style={{ animation: "fade-y-in 0.6s ease 2s both" }}>
        <div className="flex flex-col items-center gap-2 text-gray-3">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase">Scroll</span>
          <ArrowDown size={14} className="animate-bounce" />
        </div>
      </div>
    </section>
  );
}

function MarqueeSection() {
  const items = [
    "ZERO DESCULPA",
    "TREINO TODO DIA",
    "SHAPE DE VERDADE",
    "CONSULTORIA VIP",
    "CUPONS EXCLUSIVOS",
    "STREAK DIÁRIO",
    "CHAT COM A KATH",
    "VOCÊ AGUENTA?",
  ];
  const content = items.join("  ·  ") + "  ·  ";

  return (
    <section className="py-6 border-y border-gray-4/30 overflow-hidden">
      <div className="flex animate-marquee" style={{ animationDuration: "40s" }}>
        <span className="font-display text-[14px] sm:text-[18px] text-gray-3/60 tracking-[0.15em] whitespace-nowrap pr-8">{content}</span>
        <span className="font-display text-[14px] sm:text-[18px] text-gray-3/60 tracking-[0.15em] whitespace-nowrap pr-8">{content}</span>
        <span className="font-display text-[14px] sm:text-[18px] text-gray-3/60 tracking-[0.15em] whitespace-nowrap pr-8">{content}</span>
      </div>
    </section>
  );
}

function SocialProofSection() {
  return (
    <section className="relative py-20 px-6">
      <div className="line-glow max-w-4xl mx-auto mb-16" />
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <StatCard value="351K" label="Mulheres que já decidiram" icon={<Instagram size={20} className="text-pink" />} />
          <StatCard value="2.847" label="Treinos finalizados" icon={<Dumbbell size={20} className="text-pink" />} />
          <StatCard value="98%" label="Aprovação das alunas" icon={<Heart size={20} className="text-pink" />} />
          <StatCard value="150+" label="Vídeos no app" icon={<PlayCircle size={20} className="text-pink" />} />
        </div>
      </div>
      <div className="line-glow max-w-4xl mx-auto mt-16" />
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="neon-spot neon-spot-purple w-[400px] h-[400px] top-0 right-[20%] opacity-10" style={{ animation: "neon-drift 14s ease-in-out infinite" }} />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4" style={{ animation: "fade-y-in 0.6s ease both" }}>
            Sem enrolação
          </p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white">TRÊS PASSOS. SÓ.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          <StepCard number="01" title="ENTRA" description="30 segundos. Sem cartão, sem formulário gigante. Se você sabe digitar um email, já deu." icon={<Sparkles size={24} />} />
          <StepCard number="02" title="ESCOLHE" description="Free pra experimentar. Start, Pro ou VIP pra quem leva a sério. Sem contrato, sem pegadinha." icon={<Crown size={24} />} />
          <StepCard number="03" title="TREINA" description="Aperta play e vai. Vídeos HD, macros calculados e eu te cobrando. Não tem desculpa." icon={<Flame size={24} />} />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="neon-spot neon-spot-pink w-[600px] h-[600px] top-1/3 left-0 -translate-x-1/3 opacity-12" style={{ animation: "neon-drift 18s ease-in-out infinite" }} />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Tudo num app só</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white mb-4">
            O QUE VOCÊ <span className="text-gradient-pink">GANHA</span>
          </h2>
          <p className="text-gray-2 max-w-lg mx-auto">
            Chega de juntar app de treino, planilha de dieta e grupo de WhatsApp. Aqui tem tudo. Ou você prefere continuar improvisando?
          </p>
        </div>

        {/* Main feature — Video Training (hero card with tilt) */}
        <div className="relative bg-bg-1 border border-gray-4 rounded-[22px] p-8 lg:p-12 mb-8 overflow-hidden group hover:border-pink/30 transition-all duration-500" style={{ transformStyle: "preserve-3d" }}>
          <div className="neon-spot neon-spot-pink w-[400px] h-[400px] top-0 right-0 opacity-15 group-hover:opacity-30 transition-opacity duration-700" />
          <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="pink" className="mb-6">
                <PlayCircle size={12} />
                DESTAQUE
              </Badge>
              <h3 className="font-display text-[40px] sm:text-[56px] leading-[0.85] text-white mb-4">
                TREINOS EM<br /><span className="text-gradient-pink">VÍDEO HD</span>
              </h3>
              <p className="text-gray-2 leading-relaxed mb-6">
                Não é vídeo genérico de YouTube. São treinos que eu gravo, eu executo e eu garanto resultado. Glúteos, pernas, HIIT, corpo todo. Novos toda semana. Filtre por nível e vá sem medo.
              </p>
              <div className="flex flex-wrap gap-2">
                <MiniFeature icon={<Flame size={14} />} text="Streak diário" />

                <MiniFeature icon={<Target size={14} />} text="Por nível" />
                <MiniFeature icon={<PlayCircle size={14} />} text="HD nativo" />
              </div>
            </div>
            {/* Mockup do app */}
            <div className="mx-auto lg:mx-0 lg:ml-auto">
              <img
                src="/images/app-mockup.jpeg"
                alt="KathApp treinos em vídeo"
                className="w-[280px] h-auto rounded-[24px] border border-gray-4 group-hover:border-pink/20 transition-colors duration-500"
              />
            </div>
          </div>
        </div>

        {/* Feature grid — 2x3 with stagger */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon={<Target size={24} className="text-pink" />} title="CONSULTORIA" description="Eu monto seu treino e sua dieta. Nada de PDF genérico. É personalizado, é direto no app, é comigo." tag="VIP" />
          <FeatureCard icon={<Calculator size={24} className="text-pink" />} title="MACROS" description="Para de chutar o que come. Calcula suas calorias e macros em segundos com o meu método." />
          <FeatureCard icon={<MessageCircle size={24} className="text-pink" />} title="CHAT DIRETO" description="Fala comigo. Sem intermediário, sem bot. Tira dúvida, pede ajuste, desabafa. Eu respondo." tag="VIP" />
          <FeatureCard icon={<Tag size={24} className="text-pink" />} title="CUPONS" description="Descontos que eu negociei pra você. Suplementos, fitness, estética e lifestyle. Exclusivo de quem tá dentro." />
          <FeatureCard icon={<ShoppingBag size={24} className="text-pink" />} title="LOJA" description="O que eu uso, eu vendo aqui. Suplementos, acessórios e mais. Sem enganação, com entrega rastreada." />
          <FeatureCard icon={<Flame size={24} className="text-pink" />} title="STREAK" description="Faltou um dia? O streak zera. Simples assim. Consistência se prova, não se promete." />
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[500px] h-[500px] bottom-0 right-0 translate-x-1/3 opacity-10" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Não sou eu falando</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white">ELAS PROVARAM</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <TestimonialCard name="Camila S." text="3 meses de consultoria personalizada e meu shape mudou completamente. A Kath não passa treino genérico — ela monta pro SEU corpo." rating={5} plan="ATLETA" />
          <TestimonialCard name="Juliana M." text="Os vídeos são incríveis, dá pra treinar em casa ou na academia. E os cupons já me economizaram mais que a assinatura!" rating={5} plan="PLANO 2" />
          <TestimonialCard name="Fernanda R." text="Comecei no free duvidando. Em 2 semanas já fiz upgrade. A qualidade dos treinos é de outro nível." rating={5} plan="ACESSO" />
        </div>
      </div>
    </section>
  );
}

function PricingSection({ plans }: { plans: Plan[] }) {
  // Plano destacado: maior price antes do "atleta" (ou último não-atleta)
  const sortedPlans = [...plans].sort((a, b) => a.level - b.level);
  const lastPaid = [...sortedPlans].reverse().find((p) => p.asaas_value > 0);

  return (
    <section className="py-28 px-6 relative">
      <div className="neon-spot neon-spot-purple w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-8" style={{ animation: "neon-drift 20s ease-in-out infinite" }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Sem pegadinha</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white mb-4">
            QUANTO VALE O <span className="text-gradient-pink">SEU SHAPE?</span>
          </h2>
          <p className="text-gray-2 max-w-md mx-auto">Começa grátis. Faz upgrade quando cansar de ficar no básico.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {sortedPlans.map((plan) => (
            <PlanCardLanding
              key={plan.slug}
              plan={plan}
              featured={plan.slug === "plano3"}
              premium={plan.slug === lastPaid?.slug && lastPaid.slug !== "plano3"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function planFeaturesToList(plan: Plan): { text: string; included: boolean }[] {
  const f: PlanFeatures = plan.features ?? {};
  const items: { text: string; included: boolean }[] = [];

  if (f.workouts) {
    items.push({ included: true, text: "Biblioteca completa de treinos" });
  } else if (typeof f.workouts_preview === "number" && f.workouts_preview > 0) {
    items.push({ included: true, text: `${f.workouts_preview} treinos preview` });
  } else {
    items.push({ included: false, text: "Treinos completos" });
  }

  items.push({ included: !!f.diet, text: "Plano de dieta personalizado" });
  items.push({ included: !!f.supplements, text: "Acompanhamento de suplementos" });

  if (typeof f.chat_sla_h === "number") {
    items.push({ included: true, text: `Chat com a Kath (SLA ${f.chat_sla_h}h)` });
  } else {
    items.push({ included: false, text: "Chat com a Kath" });
  }

  if (typeof f.video_call_per_month === "number" && f.video_call_per_month > 0) {
    items.push({ included: true, text: `${f.video_call_per_month}x vídeo 1-1/mês` });
  }

  if (f.affiliate_clicks_per_month === "unlimited") {
    items.push({ included: true, text: "Cupons + afiliados ilimitados" });
  } else if (typeof f.affiliate_clicks_per_month === "number") {
    items.push({ included: true, text: `${f.affiliate_clicks_per_month} cupons/mês` });
  }

  if (f.estetica_book_all) {
    items.push({ included: true, text: "Agenda estética liberada" });
  }

  if (plan.cashback_pct > 0) {
    items.push({ included: true, text: `Cashback ${plan.cashback_pct}%` });
  }
  if (plan.store_discount_pct > 0) {
    items.push({ included: true, text: `${plan.store_discount_pct}% off loja` });
  }

  return items;
}

function PlanCardLanding({
  plan,
  featured = false,
  premium = false,
}: {
  plan: Plan;
  featured?: boolean;
  premium?: boolean;
}) {
  const items = planFeaturesToList(plan);
  const isFree = plan.price_cents === 0;
  const priceLabel = isFree
    ? "FREE"
    : `R$${(plan.price_cents / 100).toFixed(2).replace(".", ",")}`;
  const periodLabel = isFree ? "para sempre" : "/mês";

  return (
    <div
      className={`bg-bg-1 border rounded-[22px] p-6 relative overflow-hidden transition-all duration-500 hover:-translate-y-2 group flex flex-col ${
        featured
          ? "border-pink bg-gradient-to-b from-[#1A0010] to-bg-1 shadow-[0_0_60px_rgba(255,0,128,0.1)]"
          : premium
            ? "border-pink/40 bg-gradient-to-b from-[#120008] to-bg-1"
            : "border-gray-4 hover:border-gray-3"
      }`}
    >
      {featured && (
        <div className="absolute top-4 right-[-28px] bg-pink text-white text-[9px] font-bold tracking-[0.12em] px-9 py-1 rotate-45">
          POPULAR
        </div>
      )}
      {premium && !featured && <Crown size={16} className="absolute top-5 right-5 text-pink/60" />}

      <div className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase mb-2.5">{plan.name}</div>
      <div className="font-display text-[36px] sm:text-[44px] leading-none text-white group-hover:text-gradient-pink transition-colors duration-300">
        {priceLabel}
      </div>
      <div className="text-[12px] text-gray-3 mb-5">{periodLabel}</div>

      <div className="flex flex-col gap-2 mb-5 flex-1">
        {items.map((it, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-[12.5px] ${it.included ? "text-gray-1" : "text-gray-3/50"}`}
          >
            <span className={`mt-0.5 ${it.included ? "text-pink" : "text-gray-4"}`}>
              {it.included ? <Check size={14} /> : <span className="inline-block w-[14px] text-center">-</span>}
            </span>
            <span>{it.text}</span>
          </div>
        ))}
      </div>

      <Link href="/registro" className="block">
        <Button
          variant={featured ? "primary" : isFree ? "ghost" : premium ? "primary" : "secondary"}
          className="w-full"
          size="sm"
        >
          {isFree ? "Começar Grátis" : premium ? "Quero esse plano" : "Assinar"}
        </Button>
      </Link>
    </div>
  );
}

function KathEsteticaSection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[500px] h-[500px] top-0 right-0 opacity-10" />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <Badge variant="pink" className="mb-4">
            <Bike size={12} />
            KATH GUEDES ESTÉTICA MOTO
          </Badge>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[0.9]">
            SUA MOTO NO <span className="text-gradient-pink">PADRÃO KATH</span>
          </h2>
          <p className="text-gray-2 text-lg max-w-2xl mx-auto mt-5 leading-relaxed">
            Estética profissional exclusiva pra motos. Agende, pague e acompanhe tudo pelo app.
            Lavagem premium, polimento, vitrificação, proteção e detalhamento — com programa
            de fidelidade que premia quem cuida de verdade.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <EsteticaFeature
            icon={<Sparkles size={22} />}
            title="LAVAGEM PREMIUM"
            desc="Detalhada, sem deixar passar nada — do farol ao escapamento"
          />
          <EsteticaFeature
            icon={<Star size={22} />}
            title="POLIMENTO"
            desc="Remoção de riscos na pintura e brilho de zero quilômetro"
          />
          <EsteticaFeature
            icon={<Check size={22} />}
            title="VITRIFICAÇÃO"
            desc="Proteção de longa duração que repele água, poeira e insetos"
          />
          <EsteticaFeature
            icon={<Heart size={22} />}
            title="HIGIENIZAÇÃO"
            desc="Limpeza profunda de bancos, carenagens e componentes"
          />
        </div>

        {/* Fidelidade highlight */}
        <div className="bg-bg-1 border border-pink/30 rounded-[22px] p-8 lg:p-10 relative overflow-hidden">
          <div className="neon-spot neon-spot-pink w-[400px] h-[400px] -top-20 -right-20 opacity-20" />
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8 justify-between">
            <div className="flex items-start gap-5 max-w-2xl">
              <div className="w-16 h-16 bg-pink-dim rounded-[16px] flex items-center justify-center border border-pink/30 shrink-0">
                <Sparkles size={28} className="stroke-pink" />
              </div>
              <div>
                <Badge variant="pink" className="mb-2">PROGRAMA FIDELIDADE</Badge>
                <h3 className="font-display text-3xl lg:text-4xl text-white leading-tight mb-2">
                  4 LAVAGENS COM FOTO = <span className="text-gradient-pink">5ª GRÁTIS</span>
                </h3>
                <p className="text-gray-2 leading-relaxed">
                  A cada lavagem na Kath Guedes Estética Moto, envie uma foto da sua moto pelo app.
                  Ao atingir 4 fotos aprovadas no mesmo mês, a 5ª lavagem sai 100% grátis. Todo mês recomeça.
                </p>
              </div>
            </div>
            <Link href="/registro" className="shrink-0">
              <Button size="lg">
                Começar agora
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>

        {/* Sub-benefícios */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <MiniFeature icon={<Check size={14} />} text="Agendamento online" />
          <MiniFeature icon={<Zap size={14} />} text="Pagamento via Pix" />
          <MiniFeature icon={<Sparkles size={14} />} text="Portfólio antes/depois" />
          <MiniFeature icon={<Crown size={14} />} text="Desconto assinantes" />
        </div>
      </div>
    </section>
  );
}

function EsteticaFeature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[18px] p-5 hover:border-pink/35 transition-all duration-300 group">
      <div className="w-12 h-12 bg-pink-dim rounded-[12px] flex items-center justify-center border border-pink/20 text-pink mb-3 group-hover:shadow-[0_0_20px_rgba(255,0,128,0.25)] transition-all">
        {icon}
      </div>
      <div className="font-display text-[20px] text-white leading-tight mb-1">
        {title}
      </div>
      <p className="text-[13px] text-gray-3 leading-relaxed">{desc}</p>
    </div>
  );
}

function CtaSection() {
  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[700px] h-[700px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" style={{ animation: "neon-drift 15s ease-in-out infinite" }} />
      <div className="neon-spot neon-spot-purple w-[400px] h-[400px] top-[30%] right-[10%] opacity-10" style={{ animation: "neon-drift 12s ease-in-out infinite reverse" }} />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        {/* Avatar da Kath — coloque kath-avatar.jpg em /public/images/ */}
        <div className="w-28 h-28 mx-auto mb-10 rounded-full border-2 border-pink/50 bg-bg-2 overflow-hidden shadow-[0_0_60px_rgba(255,0,128,0.25)]">
          <Image
            src="/images/kath-avatar.jpg"
            alt="Kath Guedes"
            width={112}
            height={112}
            className="object-cover w-full h-full"
          />
        </div>

        <h2 className="font-display text-5xl sm:text-7xl lg:text-8xl text-white mb-6 leading-[0.85]">
          VAI FICAR SÓ<br /><span className="text-gradient-pink">OLHANDO?</span>
        </h2>

        <p className="text-gray-2 text-lg sm:text-xl max-w-xl mx-auto mb-12 leading-relaxed">
          Milhares de mulheres já pararam de dar desculpa e começaram a mudar.
          Eu te guio em cada treino. A pergunta é: você vai ou vai ficar aí?
        </p>

        <Link href="/registro">
          <Button size="xl" className="group">
            Eu Quero Entrar
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
        <p className="font-mono text-[11px] text-gray-3 mt-8 tracking-[0.1em] uppercase">
          Grátis pra começar · Cancela quando quiser
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="py-24 px-6 border-t border-gray-4/30">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl sm:text-5xl text-white text-center mb-14">PERGUNTAS FREQUENTES</h2>
        <div className="space-y-4">
          <FaqItem question="É grátis mesmo?" answer="Sim. Treinos preview liberados, loja e afiliados básicos. Sem cartão, sem pegadinha. Se gostar (e vai gostar), faz upgrade quando quiser." />
          <FaqItem question="O que tem nos planos com consultoria?" answer="Eu monto seu treino e sua dieta personalizados. Você fala comigo direto pelo chat, tem reavaliações periódicas e descontos na loja e na estética. Tudo dentro do app, nada de PDF." />
          <FaqItem question="Que tipo de treino tem?" answer="Glúteos, pernas, superiores, HIIT, corpo todo. Tudo em vídeo HD, gravado por mim. Novos treinos toda semana pra quem assina." />
          <FaqItem question="E se eu quiser cancelar?" answer="Cancela pelo app, na hora, sem ninguém te perguntando por quê. Sem multa, sem burocracia. Mas duvido que você vai querer." />
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="relative py-16 px-6 border-t border-gray-4/30 footer-gradient">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/icons/logo-navbar.png" alt="KathApp" width={32} height={32} className="rounded-lg" />
            <span className="font-display text-lg text-white tracking-wider">KATHAPP</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="https://instagram.com/kathguedes" target="_blank" className="p-2 text-gray-3 hover:text-pink transition-colors duration-300">
              <Instagram size={18} />
            </Link>
            <Link href="https://youtube.com/@kathguedes" target="_blank" className="p-2 text-gray-3 hover:text-pink transition-colors duration-300">
              <Youtube size={18} />
            </Link>
          </div>
          <p className="font-mono text-[10px] text-gray-3 tracking-[0.1em] uppercase">&copy; 2026 KATHAPP · TODOS OS DIREITOS RESERVADOS</p>
        </div>
      </div>
    </footer>
  );
}


/* ════════════════════════════════════════════════════
   UI COMPONENTS
   ════════════════════════════════════════════════════ */

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center group">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="group-hover:scale-110 transition-transform duration-300">{icon}</span>
        <span className="font-display text-[40px] sm:text-[52px] leading-none text-white">{value}</span>
      </div>
      <p className="font-mono text-[10px] text-gray-3 tracking-[0.1em] uppercase">{label}</p>
    </div>
  );
}

function StepCard({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="relative text-center group">
      <div className="font-display text-[100px] leading-none text-pink/[0.04] absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 select-none group-hover:text-pink/[0.08] transition-colors duration-700">
        {number}
      </div>
      <div className="relative z-10">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-pink-dim border border-pink/20 flex items-center justify-center text-pink group-hover:shadow-[0_0_40px_rgba(255,0,128,0.25)] group-hover:scale-105 transition-all duration-500">
          {icon}
        </div>
        <h3 className="font-display text-2xl text-white mb-3">{title}</h3>
        <p className="text-gray-2 text-[14px] leading-relaxed max-w-[280px] mx-auto">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, tag }: { icon: React.ReactNode; title: string; description: string; tag?: string }) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 transition-all duration-500 hover:border-pink/30 hover:-translate-y-2 group relative overflow-hidden" style={{ transformStyle: "preserve-3d" }}>
      <div className="neon-spot neon-spot-pink w-[200px] h-[200px] top-0 right-0 opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
      <div className="relative z-10">
        {tag && <Badge variant="pink" className="absolute top-0 right-0 text-[9px]">{tag}</Badge>}
        <div className="w-12 h-12 bg-pink-dim rounded-[14px] flex items-center justify-center border border-pink/20 mb-4 group-hover:shadow-[0_0_25px_rgba(255,0,128,0.2)] group-hover:scale-110 transition-all duration-500">
          {icon}
        </div>
        <h3 className="font-display text-[20px] leading-none text-white mb-2">{title}</h3>
        <p className="text-[13px] text-gray-2 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function MiniFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-2 border border-gray-4 text-[11px] text-gray-2 font-medium hover:border-pink/30 hover:text-gray-1 transition-all duration-300">
      <span className="text-pink">{icon}</span>
      {text}
    </span>
  );
}

function TestimonialCard({ name, text, rating, plan }: { name: string; text: string; rating: number; plan: string }) {
  return (
    <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 hover:border-pink/20 hover:-translate-y-1 transition-all duration-500 group">
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} size={14} className="fill-pink text-pink" />
        ))}
      </div>
      <p className="text-[14px] text-gray-1 leading-relaxed mb-6">&ldquo;{text}&rdquo;</p>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white font-medium">{name}</span>
        <Badge variant="pink" className="text-[9px]">{plan}</Badge>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-bg-1 border border-gray-4 rounded-[16px] overflow-hidden hover:border-gray-3/50 transition-colors duration-300">
      <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
        <span className="font-body text-[15px] text-white font-medium pr-4">{question}</span>
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-bg-2 border border-gray-4 flex items-center justify-center text-gray-2 group-open:rotate-45 group-open:bg-pink group-open:border-pink group-open:text-white transition-all duration-300">
          <span className="text-sm leading-none">+</span>
        </span>
      </summary>
      <div className="px-5 pb-5 text-[14px] text-gray-2 leading-relaxed">{answer}</div>
    </details>
  );
}
