import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActivePlans, type Plan } from "@/lib/billing/plans";
import {
  PlayCircle,
  Target,
  Calculator,
  Tag,
  ShoppingBag,
  MessageCircle,
  Flame,
  ArrowRight,
  ArrowDown,
  Crown,
  Sparkles,
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
import { PricingCards, type PricingPlan } from "./pricing-cards";
import { PLAN_FEATURE_LISTS } from "@/lib/billing/plan-features";
import { AppVideoPreview } from "./app-video-preview";
import { StickyMobileCta } from "./sticky-cta";

export const metadata: Metadata = {
  title: "KathApp — Fitness e Consultoria | Kath Guedes",
  description:
    "O app da Kath Guedes: treinos em vídeo, consultoria fitness personalizada (treino + dieta + acompanhamento), loja de suplementos e cupons exclusivos. Conteúdo nativo no app — sem PDF.",
  keywords: [
    "kath guedes",
    "app de treino",
    "consultoria fitness",
    "treino online feminino",
    "treino de glúteos",
    "treino bikini",
    "preparação atleta bikini",
    "dieta personalizada",
    "calculadora de macros",
    "suplementos fitness",
  ],
  alternates: { canonical: "https://www.kathguedes.com.br" },
  openGraph: {
    title: "KathApp — Treinos em Vídeo, Consultoria Fitness e Loja",
    description: "Treinos em vídeo exclusivos, consultoria de treino e dieta personalizada, calculadora de macros, loja fitness e cupons. O app da Kath Guedes.",
    url: "https://www.kathguedes.com.br",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "KathApp — App fitness da Kath Guedes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KathApp — Treinos, Consultoria Fitness e Loja",
    description: "Treinos em vídeo, consultoria personalizada, calculadora de macros e loja fitness. O app da Kath Guedes.",
    images: ["/og-image.png"],
  },
};

// ISR: serve a landing do cache e revalida a cada 5 min. Preço/planos mudam
// raramente; ao editar planos no admin, dispare revalidatePath("/") se quiser
// refletir na hora. Evita ida ao Supabase a cada visita (era force-dynamic).
export const revalidate = 300;

function buildJsonLd(plans: Plan[]) {
  const paid = plans.filter((p) => p.is_active && p.asaas_value > 0);
  const planOffers = paid.map((p) => ({
    "@type": "Offer",
    price: (p.price_cents / 100).toFixed(2),
    priceCurrency: "BRL",
    name: p.name,
    description: p.asaas_description || `Plano ${p.name}`,
    url: `https://www.kathguedes.com.br/planos`,
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: (p.price_cents / 100).toFixed(2),
      priceCurrency: "BRL",
      billingDuration: 1,
      billingIncrement: 1,
      unitCode: "MON",
    },
  }));

  const planSummary = paid
    .map((p) => `${p.name} (${(p.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês)`)
    .join(", ");

  // Schema Product por plano — Google Shopping / Rich Results.
  const planProducts = paid.map((p) => ({
    "@type": "Product",
    "@id": `https://www.kathguedes.com.br/#plan-${p.slug}`,
    name: `KathApp — ${p.name}`,
    description: p.asaas_description || `Plano ${p.name} do KathApp.`,
    brand: { "@id": "https://www.kathguedes.com.br/#organization" },
    image: "https://www.kathguedes.com.br/og-image.png",
    offers: {
      "@type": "Offer",
      price: (p.price_cents / 100).toFixed(2),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `https://www.kathguedes.com.br/planos?autostart=${p.slug}`,
      seller: { "@id": "https://www.kathguedes.com.br/#organization" },
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      // Organization
      {
        "@type": "Organization",
        "@id": "https://www.kathguedes.com.br/#organization",
        name: "KathApp",
        legalName: "KathApp",
        url: "https://www.kathguedes.com.br",
        logo: {
          "@type": "ImageObject",
          url: "https://www.kathguedes.com.br/icons/icon-512.png",
          width: 512,
          height: 512,
        },
        description:
          "App fitness da Kath Guedes com treinos em vídeo, consultoria personalizada de treino e dieta, loja de suplementos e cupons exclusivos.",
        founder: { "@id": "https://www.kathguedes.com.br/#kath-guedes" },
        sameAs: [
          "https://www.instagram.com/kathguedes",
          "https://www.youtube.com/@kathguedes",
          "https://www.tiktok.com/@kathguedes",
        ],
      },
      // Person — E-A-T (Expertise, Authoritativeness, Trustworthiness)
      {
        "@type": "Person",
        "@id": "https://www.kathguedes.com.br/#kath-guedes",
        name: "Kath Guedes",
        givenName: "Kath",
        familyName: "Guedes",
        jobTitle: "Atleta Bikini e Treinadora",
        description:
          "Atleta Bikini com mais de 350 mil seguidores. Especialista em treino de glúteos, pernas e composição corporal para mulheres.",
        url: "https://www.kathguedes.com.br",
        image: "https://www.kathguedes.com.br/images/kath-bikini.jpg",
        worksFor: { "@id": "https://www.kathguedes.com.br/#organization" },
        sameAs: [
          "https://www.instagram.com/kathguedes",
          "https://www.youtube.com/@kathguedes",
        ],
      },
      // WebSite — habilita Sitelinks Search Box
      {
        "@type": "WebSite",
        "@id": "https://www.kathguedes.com.br/#website",
        url: "https://www.kathguedes.com.br",
        name: "KathApp",
        publisher: { "@id": "https://www.kathguedes.com.br/#organization" },
        inLanguage: "pt-BR",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://www.kathguedes.com.br/fitness?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
      // SoftwareApplication — categoria HealthApplication
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.kathguedes.com.br/#app",
        name: "KathApp",
        operatingSystem: "Web, Android, iOS (PWA)",
        applicationCategory: "HealthApplication",
        applicationSubCategory: "Fitness",
        offers: planOffers,
        author: { "@id": "https://www.kathguedes.com.br/#organization" },
        description:
          "App de fitness com treinos em vídeo, consultoria personalizada de treino e dieta, loja de suplementos e cupons exclusivos.",
        screenshot: "https://www.kathguedes.com.br/og-image.png",
        inLanguage: "pt-BR",
        featureList: [
          "Biblioteca de treinos em vídeo HD",
          "Consultoria personalizada de treino e dieta",
          "Calculadora de macros",
          "Streak diário",
          "Cupons exclusivos com parceiros",
          "Cashback em compras",
          "Chat direto com a Kath (planos premium)",
        ],
      },
      // Produtos / planos individuais
      ...planProducts,
      // Breadcrumb — Google usa para Sitelinks
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.kathguedes.com.br/#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.kathguedes.com.br",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Planos",
            item: "https://www.kathguedes.com.br/planos",
          },
        ],
      },
      // FAQ — alimenta People Also Ask + Rich Results
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Quanto custa o KathApp?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `KathApp tem 4 planos: ${planSummary || "Treino, Performance, Saúde Completa e Atleta"}. Cada um é cobrado em ciclo semestral ou anual — à vista no PIX/boleto ou parcelado no cartão. Quanto maior o período, menor o preço por mês.`,
            },
          },
          {
            "@type": "Question",
            name: "O que inclui a consultoria personalizada?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Os planos Performance, Saúde Completa e Atleta incluem plano de treino e dieta personalizados montados pela Kath dentro do app. Sem PDFs — tudo nativo no app, fácil de seguir no celular.",
            },
          },
          {
            "@type": "Question",
            name: "Quais tipos de treino estão disponíveis?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Biblioteca completa em vídeo HD: glúteos, pernas, quadríceps, costas, ombro, bíceps, tríceps, peito, abdômen, HIIT, cardio, funcional, alongamento e aquecimento. Novos treinos adicionados toda semana.",
            },
          },
          {
            "@type": "Question",
            name: "A assinatura renova automaticamente?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No PIX e boleto a assinatura é recorrente e renova ao fim do ciclo (semestral ou anual) — você pode desligar a renovação quando quiser, mantendo o acesso até o fim do período pago. No cartão parcelado não há renovação automática.",
            },
          },
          {
            "@type": "Question",
            name: "Como funciona o cashback do KathApp?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Cada plano dá uma porcentagem de cashback na loja KathApp — de 3% (Treino) a 10% (Atleta). O saldo é creditado a cada pedido entregue e usado em compras futuras.",
            },
          },
          {
            "@type": "Question",
            name: "O KathApp tem app para celular?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim, é um PWA (Progressive Web App). Funciona em qualquer celular Android ou iPhone com instalação direta pela tela inicial — sem precisar baixar da loja.",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />

      <NavBar />
      <HeroSection />
      <MarqueeSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AboutSection />
      <PricingSection plans={plans} />
      <CtaSection />
      <FaqSection />
      <FooterSection />
      <StickyMobileCta />
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

        {/* Selo de credito — Kath (atleta) + Sidney Cyborg (treinador) */}
        <div style={{ animation: "fade-y-in 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) 0.4s both" }}>
          <span className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-bg-2/60 border border-gray-4 backdrop-blur-sm font-mono text-[10px] sm:text-[11px] text-gray-2 tracking-[0.15em] uppercase">
            <span className="text-pink">●</span>
            Atleta Kath Guedes · Treinos por Sidney Cyborg
          </span>
        </div>

        {/* Hero title — 3D rotate reveal (hape.io). Tamanho enxuto pra nao
            cobrir o video no celular. */}
        <div className="mb-5">
          <div className="overflow-hidden">
            <h1
              className="font-display text-[40px] sm:text-[60px] lg:text-[84px] xl:text-[96px] leading-[0.85] text-white tracking-tight"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.6s both" }}
            >
              RESULTADO REAL
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="font-display text-[40px] sm:text-[60px] lg:text-[84px] xl:text-[96px] leading-[0.85] text-gradient-pink"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.75s both" }}
            >
              COMEÇA
            </h1>
          </div>
          <div className="overflow-hidden">
            <h1
              className="font-display text-[40px] sm:text-[60px] lg:text-[84px] xl:text-[96px] leading-[0.85] text-white"
              style={{ animation: "title-rotate-in 1.1s cubic-bezier(0.165, 0.84, 0.44, 1) 0.9s both" }}
            >
              AQUI.
            </h1>
          </div>
        </div>

        {/* Subtitle — fade up (curto, pra deixar o video respirar) */}
        <div style={{ animation: "fade-y-in 0.9s cubic-bezier(0.165, 0.84, 0.44, 1) 1.2s both" }}>
          <p className="font-body text-[15px] sm:text-lg text-gray-2 max-w-md sm:max-w-lg mx-auto mb-7 leading-relaxed">
            Treino, dieta e acompanhamento num app só. Feito pra você evoluir de verdade.
          </p>
        </div>

        {/* CTAs — scale in. Um CTA principal + login discreto. */}
        <div style={{ animation: "fade-y-in 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) 1.5s both" }}>
          <div className="flex flex-col items-center gap-3 mb-4">
            <Link href="/registro">
              <Button size="lg" className="group">
                Quero Começar
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link
              href="/login"
              className="text-[13px] text-gray-3 hover:text-white transition-colors"
            >
              Já tenho conta
            </Link>
          </div>
          <p className="font-mono text-[10px] sm:text-[11px] text-gray-3 tracking-[0.1em] uppercase">
            Planos semestral e anual · PIX ou cartão parcelado
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

function HowItWorksSection() {
  return (
    <section className="py-16 sm:py-28 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-purple w-[400px] h-[400px] top-0 right-[20%] opacity-10" style={{ animation: "neon-drift 14s ease-in-out infinite" }} />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4" style={{ animation: "fade-y-in 0.6s ease both" }}>
            Sem enrolação
          </p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white">TRÊS PASSOS. SÓ.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          <StepCard number="01" title="ENTRA" description="Comece sua transformação agora. Cadastro rápido, sem burocracia e direto ao ponto." icon={<Sparkles size={24} />} />
          <StepCard number="02" title="ESCOLHE" description="Escolha o plano ideal pra você. Treino, alimentação, acompanhamento e suporte real." icon={<Crown size={24} />} />
          <StepCard number="03" title="TREINA" description="Treine com direção. Vídeos completos, estratégias personalizadas e resultado de verdade." icon={<Flame size={24} />} />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-16 sm:py-28 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[600px] h-[600px] top-1/3 left-0 -translate-x-1/3 opacity-12" style={{ animation: "neon-drift 18s ease-in-out infinite" }} />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Tudo num app só</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white mb-4">
            O QUE VOCÊ <span className="text-gradient-pink">GANHA</span>
          </h2>
          <p className="text-gray-2 max-w-lg mx-auto leading-relaxed">
            Treino, dieta, acompanhamento e estratégia em um só lugar. Tudo pensado pra quem quer resultado de verdade.
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
                Não é treino genérico de internet. São treinos reais, com execução guiada, foco em evolução e resultados de verdade. Glúteos, pernas, HIIT e corpo todo. Novos treinos toda semana. Escolha seu nível e evolua.
              </p>
              <div className="flex flex-wrap gap-2">
                <MiniFeature icon={<Flame size={14} />} text="Streak diário" />

                <MiniFeature icon={<Target size={14} />} text="Por nível" />
                <MiniFeature icon={<PlayCircle size={14} />} text="HD nativo" />
              </div>
            </div>
            <AppVideoPreview />
          </div>
        </div>

        {/* Feature grid — 2x3 with stagger */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon={<Target size={24} className="text-pink" />} title="CONSULTORIA" description="Muito além de um treino. Você recebe planejamento personalizado, dieta ajustada às suas necessidades e acompanhamento próximo para acelerar seus resultados." tag="VIP" />
          <FeatureCard icon={<Calculator size={24} className="text-pink" />} title="MACROS" description="Mais estratégia. Menos achismo. Calcule calorias e macronutrientes em segundos e tenha mais controle sobre seus resultados." />
          <FeatureCard icon={<MessageCircle size={24} className="text-pink" />} title="CHAT DIRETO" description="Você não estará sozinho. Tenha acesso direto para tirar dúvidas, receber ajustes e manter o foco no seu objetivo." tag="VIP" />
          <FeatureCard icon={<Tag size={24} className="text-pink" />} title="CUPONS" description="Economize em marcas parceiras. Acesse descontos exclusivos em produtos e serviços que fazem parte do seu estilo de vida." />
          <FeatureCard icon={<ShoppingBag size={24} className="text-pink" />} title="LOJA" description="Tudo em um só lugar. Suplementos, acessórios e produtos escolhidos para potencializar seus resultados." />
          <FeatureCard icon={<Flame size={24} className="text-pink" />} title="STREAK" description="Resultado não vem da motivação. Vem da consistência. Mantenha sua sequência e evolua todos os dias." />
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="py-16 sm:py-28 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[500px] h-[500px] top-1/4 right-0 translate-x-1/4 opacity-10" style={{ animation: "neon-drift 17s ease-in-out infinite" }} />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Quem está por trás</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white mb-4">
            ATLETA + <span className="text-gradient-pink">TREINADOR</span>
          </h2>
          <p className="text-gray-2 max-w-xl mx-auto leading-relaxed">
            A vivência de quem compete no palco com o método de quem monta treino todos os
            dias. É essa dupla que constrói o seu resultado.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Kath Guedes */}
          <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 flex flex-col items-center text-center transition-all duration-500 hover:border-pink/30 hover:-translate-y-1">
            <div className="w-28 h-28 mb-5 rounded-full border-2 border-pink/50 overflow-hidden shadow-[0_0_50px_rgba(255,0,128,0.2)]">
              <Image
                src="/images/kath-bikini.jpg"
                alt="Kath Guedes, atleta Bikini"
                width={224}
                height={224}
                className="object-cover w-full h-full"
              />
            </div>
            <h3 className="font-display text-2xl text-white">KATH GUEDES</h3>
            <p className="font-mono text-[11px] text-pink tracking-[0.12em] uppercase mt-1 mb-3">Atleta Bikini</p>
            <p className="text-gray-2 text-[14px] leading-relaxed">
              Atleta Bikini com mais de 350 mil seguidoras. A cara do app e a inspiração de
              quem quer treinar de verdade — do primeiro treino ao palco.
            </p>
          </div>

          {/* Sidney Cyborg */}
          <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 flex flex-col items-center text-center transition-all duration-500 hover:border-pink/30 hover:-translate-y-1">
            <div className="w-28 h-28 mb-5 rounded-full border-2 border-pink/50 overflow-hidden shadow-[0_0_50px_rgba(255,0,128,0.2)]">
              <Image
                src="/images/sidney-cyborg.jpeg"
                alt="Sidney Cyborg, treinador"
                width={224}
                height={224}
                className="object-cover object-top w-full h-full"
              />
            </div>
            <h3 className="font-display text-2xl text-white">SIDNEY CYBORG</h3>
            <p className="font-mono text-[11px] text-pink tracking-[0.12em] uppercase mt-1 mb-3">Treinador</p>
            <p className="text-gray-2 text-[14px] leading-relaxed">
              Responsável pela metodologia e pela montagem dos treinos do app. Cada plano é
              pensado para gerar evolução real, respeitando o seu nível e o seu objetivo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection({ plans }: { plans: Plan[] }) {
  const sortedPlans = [...plans].sort((a, b) => a.level - b.level);
  const cardData: PricingPlan[] = sortedPlans.map((p) => ({
    slug: p.slug,
    name: p.name,
    level: p.level,
    monthly_semestral_cents: p.monthly_semestral_cents,
    total_semestral_cents: p.total_semestral_cents,
    monthly_anual_cents: p.monthly_anual_cents,
    total_anual_cents: p.total_anual_cents,
    monthly_mensal_cents: p.monthly_mensal_cents,
    features: PLAN_FEATURE_LISTS[p.slug] ?? [],
  }));

  return (
    <section className="py-16 sm:py-28 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-purple w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-8" style={{ animation: "neon-drift 20s ease-in-out infinite" }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="font-mono text-[11px] text-pink tracking-[0.2em] uppercase mb-4">Escolha o seu</p>
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white mb-4">
            ESCOLHA O <span className="text-gradient-pink">SEU PLANO</span>
          </h2>
          <p className="text-gray-2 max-w-2xl mx-auto text-lg leading-relaxed">
            Mensal, semestral ou anual — quanto maior o compromisso, menor o preço por mês.
            Pague à vista no PIX/boleto ou parcele no cartão.
          </p>
        </div>

        <PricingCards plans={cardData} />
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-20 sm:py-32 px-6 relative overflow-hidden">
      <div className="neon-spot neon-spot-pink w-[700px] h-[700px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" style={{ animation: "neon-drift 15s ease-in-out infinite" }} />
      <div className="neon-spot neon-spot-purple w-[400px] h-[400px] top-[30%] right-[10%] opacity-10" style={{ animation: "neon-drift 12s ease-in-out infinite reverse" }} />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        {/* Avatar da Kath — foto com trofeu Miss Fit (campea — credibilidade na CTA final) */}
        <div className="w-28 h-28 mx-auto mb-10 rounded-full border-2 border-pink/50 bg-bg-2 overflow-hidden shadow-[0_0_60px_rgba(255,0,128,0.25)]">
          <Image
            src="/images/kath-trofeu.jpg"
            alt="Kath Guedes campea Miss Fit"
            width={224}
            height={224}
            className="object-cover w-full h-full"
          />
        </div>

        <p className="font-mono text-[10px] sm:text-[11px] text-gray-3 tracking-[0.15em] uppercase mb-8">
          Kath Guedes · Treinos por Sidney Cyborg
        </p>

        <h2 className="font-display text-5xl sm:text-7xl lg:text-8xl text-white mb-6 leading-[0.85]">
          CHEGA DE<br /><span className="text-gradient-pink">RECOMEÇAR</span>
        </h2>

        <p className="text-gray-2 text-lg sm:text-xl max-w-xl mx-auto mb-12 leading-relaxed">
          Tenha um plano, acompanhamento e direção. Agora é hora de construir resultados
          de verdade.
        </p>

        <Link href="/registro">
          <Button size="xl" className="group">
            Eu Quero Entrar
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
        <p className="font-mono text-[11px] text-gray-3 mt-8 tracking-[0.1em] uppercase">
          Planos semestral e anual · Parcele no cartão
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="py-16 sm:py-24 px-6 border-t border-gray-4/30">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl sm:text-5xl text-white text-center mb-14">PERGUNTAS FREQUENTES</h2>
        <div className="space-y-4">
          <FaqItem question="Qual o plano mais barato?" answer="O Treino, a partir de R$25,90/mês no plano anual (R$310,80 à vista por 12 meses) ou R$31,90/mês no semestral. Já inclui a biblioteca completa de vídeos, calculadora de macros, cupons e cashback na loja." />
          <FaqItem question="Como funciona o pagamento — semestral ou anual?" answer="Você escolhe pagar 6 meses (semestral) ou 12 meses (anual) — quanto maior o período, menor o preço por mês. Pode pagar à vista no PIX ou boleto, ou parcelar no cartão de crédito (em até 6x no semestral e 12x no anual)." />
          <FaqItem question="O que tem nos planos com consultoria?" answer="A Kath e o Sidney montam seu treino e sua dieta personalizados. Você fala direto pelo chat, tem reavaliações periódicas e descontos na loja. Tudo dentro do app, nada de PDF." />
          <FaqItem question="Que tipo de treino tem?" answer="Glúteos, pernas, posterior, quadríceps, superiores, HIIT, corpo todo. Tudo em vídeo HD na biblioteca. Novos vídeos adicionados toda semana." />
          <FaqItem question="A assinatura renova sozinha?" answer="No PIX e boleto, a assinatura é recorrente e renova automaticamente ao fim do período — você pode desligar a renovação quando quiser. No cartão parcelado não há renovação automática: ao fim do período, você decide se continua." />
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
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]">
              <Link href="/termos" className="text-gray-3 hover:text-pink transition-colors">Termos</Link>
              <Link href="/cancelamento" className="text-gray-3 hover:text-pink transition-colors">Cancelamento</Link>
              <Link href="/privacidade" className="text-gray-3 hover:text-pink transition-colors">Privacidade</Link>
            </div>
            <p className="font-mono text-[10px] text-gray-3 tracking-[0.1em] uppercase">&copy; 2026 KATHAPP · TODOS OS DIREITOS RESERVADOS</p>
            <p className="font-mono text-[10px] text-gray-4 tracking-[0.08em]">Desenvolvido por RS7 Tec</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════
   UI COMPONENTS
   ════════════════════════════════════════════════════ */

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
