# Setor: Landing Pública

## 1. Visão geral
- **Propósito:** Landing pública (home `/`) do KathApp que apresenta a marca Kath Guedes (treinos em vídeo, consultoria, calculadora, loja, cupons, Kath Estética Moto), planos de assinatura e converte visitantes em registro/login. Centraliza também o SEO técnico do site (`robots.ts` + `sitemap.ts`).
- **Quem usa:** Usuário final não autenticado (visitante anônimo). Não há áreas administrativas neste setor.
- **Status percebido:** production — página densa (827 linhas em `src/app/(public)/page.tsx`), com metadata completa, JSON-LD, OG/Twitter cards, vídeo hero, animações dedicadas e biblioteca própria de componentes de animação (`src/components/landing/`).

## 2. Rotas
| Path | Arquivo | Tipo | Descrição |
|---|---|---|---|
| `/` | `src/app/(public)/page.tsx:123` | Server Component (RSC) | Home pública: nav + hero + marquee + provas sociais + how it works + features + depoimentos + pricing + Kath Estética + CTA + FAQ + footer. |
| `/robots.txt` | `src/app/robots.ts:3` | Route handler (`MetadataRoute.Robots`) | Permite tudo exceto `/admin`, `/api`, `/onboarding`; aponta para `https://kathapp.com.br/sitemap.xml`. |
| `/sitemap.xml` | `src/app/sitemap.ts:4` | Route handler async (`MetadataRoute.Sitemap`) | Sitemap dinâmico: 13 URLs estáticas + páginas dinâmicas de `workout_videos` publicados. |

> Observação: o grupo `(public)` contém apenas `page.tsx` e `landing-shell.tsx` (helper client). Não há `layout.tsx` próprio do grupo — herda do root layout.

## 3. Componentes

### Shell e efeitos globais da landing
- **`LandingShell`** (`src/app/(public)/landing-shell.tsx:12`) — wrapper client-side da home; injeta `Preloader`, `ScrollProgress` e `MouseGlow` e aplica o fundo `bg-bg-base noise-overlay`.
- **`Preloader`** (`src/components/landing/preloader.tsx:5`) — overlay full-screen `z-[999]` que anima de 0% a 100% em ~2.2s com easing in-out quart, depois desaparece (300 ms de fade + remoção em 1.2s). Mostra `KATHAPP` com gradiente rosa.
- **`ScrollProgress`** (`src/components/landing/scroll-progress.tsx:5`) — barra horizontal de 2 px no topo (z-60) que reflete `window.scrollY / (scrollHeight - innerHeight)`.
- **`MouseGlow`** (`src/components/landing/mouse-glow.tsx:5`) — glow rosa de 400×400 px com blur que segue o mouse via lerp (fator 0.08) usando `requestAnimationFrame`. Visível apenas em `lg:` (desktop).

### Componentes de animação reutilizáveis (`src/components/landing/`)
- **`AnimatedCounter`** (`src/components/landing/animated-counter.tsx:13`) — conta de 0 até `end` com easing out-quart; inicia ao entrar no viewport (IntersectionObserver, threshold 0.5); formata em `K` para milhares.
- **`HorizontalScroll`** (`src/components/landing/horizontal-scroll.tsx:14`) — container de altura 300 vh que converte scroll vertical em translateX horizontal numa pista sticky.
- **`MagneticButton`** (`src/components/landing/magnetic-button.tsx:11`) — efeito magnético: o filho segue o cursor proporcionalmente a `strength` (default 0.3) com easing.
- **`Marquee`** (`src/components/landing/marquee.tsx:11`) — marquee infinito CSS-only (classe `animate-marquee`) com lista de itens e separador configuráveis. *Nota: não é usado pela home (`MarqueeSection` usa marquee inline em `page.tsx:313`).*
- **`Parallax`** (`src/components/landing/parallax-image.tsx:12`) — wrapper que translada filhos no eixo Y com base na distância ao centro do viewport × `speed`.
- **`ScaleReveal`** (`src/components/landing/parallax-image.tsx:44`) — reveal por escala via classes `scale-reveal-container` / `scale-reveal-inner` ativadas pelo IntersectionObserver.
- **`ScrollReveal`** (`src/components/landing/scroll-reveal.tsx:14`) — reveal genérico com direção (`up`/`down`/`left`/`right`/`none`), `delay`, `duration` e ativação por viewport (threshold 0.15, rootMargin -40 px).
- **`StaggerReveal`** (`src/components/landing/scroll-reveal.tsx:68`) — itera filhos aplicando `delay = baseDelay + i * stagger` em cada `ScrollReveal`.
- **`TextReveal`** (`src/components/landing/text-reveal.tsx:13`) — reveal de texto com variantes `slide` / `rotate` / `fade-y` (classes CSS `tr-*`).
- **`SplitTextReveal`** (`src/components/landing/text-reveal.tsx:55`) — divide string em palavras e aplica `TextReveal` por palavra com stagger.
- **`TiltCard`** (`src/components/landing/tilt-card.tsx:12`) — efeito 3D `rotateX/rotateY` proporcional à posição do mouse + glare radial opcional.

> Observação: dos 11 componentes da pasta, somente `Preloader`, `ScrollProgress` e `MouseGlow` são realmente importados por `LandingShell`. Os demais (`AnimatedCounter`, `Marquee`, `MagneticButton`, `Parallax`, `ScrollReveal`, `TextReveal`, `TiltCard`, `HorizontalScroll`) estão disponíveis mas não consumidos por `page.tsx` na versão atual — a home usa animações inline via `style={{ animation: "..." }}` e classes utilitárias (`animate-marquee`, `neon-drift`).

### Section components inline em `page.tsx`
- **`NavBar`** (`src/app/(public)/page.tsx:196`) — top bar fixa glassmorphic com logo (`/icons/logo-navbar.png`), links Instagram/YouTube, CTA "Entrar" (`/login`) e "Assinar" (`/registro`).
- **`HeroSection`** (`src/app/(public)/page.tsx:220`) — hero full-screen com vídeo `/images/kath-walk.mp4`, título 3D em três linhas ("CANSOU DE / ENROLAÇÃO? / TREINA COMIGO."), CTAs e indicador de scroll.
- **`MarqueeSection`** (`src/app/(public)/page.tsx:313`) — marquee infinito de slogans ("ZERO DESCULPA", "TREINO TODO DIA", etc.).
- **`SocialProofSection`** (`src/app/(public)/page.tsx:337`) — 4 `StatCard` (351K, 2.847, 98%, 150+).
- **`HowItWorksSection`** (`src/app/(public)/page.tsx:354`) — 3 passos: ENTRA / ESCOLHE / TREINA.
- **`FeaturesSection`** (`src/app/(public)/page.tsx:377`) — destaque de Treinos em Vídeo HD + grid 2×3 de features (Consultoria, Macros, Chat Direto, Cupons, Loja, Streak).
- **`TestimonialsSection`** (`src/app/(public)/page.tsx:440`) — 3 depoimentos hardcoded.
- **`PricingSection`** (`src/app/(public)/page.tsx:461`) — 4 planos: FREE / START R$19 / PRO R$39 (featured) / VIP R$99.
- **`KathEsteticaSection`** (`src/app/(public)/page.tsx:514`) — divulga o serviço Kath Guedes Estética Moto (lavagem, polimento, vitrificação, higienização) e o programa de fidelidade "4 lavagens com foto = 5ª grátis".
- **`CtaSection`** (`src/app/(public)/page.tsx:619`) — CTA final com avatar (`/images/kath-avatar.jpg`) e botão "Eu Quero Entrar" → `/registro`.
- **`FaqSection`** (`src/app/(public)/page.tsx:660`) — 4 perguntas em `<details>` nativo.
- **`FooterSection`** (`src/app/(public)/page.tsx:676`) — logo + redes + copyright `© 2026 KATHAPP`.

### Helpers de UI inline em `page.tsx`
- `StatCard` (`page.tsx:705`), `StepCard` (`page.tsx:717`), `FeatureCard` (`page.tsx:734`), `MiniFeature` (`page.tsx:750`), `TestimonialCard` (`page.tsx:759`), `PlanCard` (`page.tsx:776`), `EsteticaFeature` (`page.tsx:597`), `FaqItem` (`page.tsx:815`).
- Ícones de marca inline (lucide-react v1.x removeu): `Instagram` (`page.tsx:28`), `Youtube` (`page.tsx:35`).

## 4. Server Actions / API Routes
| Endpoint/Action | Método | Input | Output | Quem chama |
|---|---|---|---|---|
| `/sitemap.xml` | GET (route handler) | nenhum | `MetadataRoute.Sitemap` (XML gerado pelo Next) | Crawlers, robots |
| `/robots.txt` | GET (route handler) | nenhum | `MetadataRoute.Robots` (texto gerado pelo Next) | Crawlers, robots |

> N/A para Server Actions próprias — a landing é puramente apresentacional. Os botões da página apenas navegam (`<Link href="/registro">`, `<Link href="/login">`) para áreas autenticadas (documentadas pelo agente de Auth).

## 5. Modelo de dados
- A landing em si **não persiste dados**. Não há captura de leads, formulário de e-mail nem tracking server-side próprio.
- O `sitemap.ts` faz **uma leitura** da tabela `workout_videos` via `createAdminSupabaseClient()` (`src/app/sitemap.ts:92`) para listar treinos publicados (`is_published = true`, ordenado por `published_at desc`). Os campos consumidos são `id` e `published_at`. A modelagem de `workout_videos` é responsabilidade do agente de Fitness/Treinos.

## 6. Integrações externas
- **SEO `robots`** (`src/app/robots.ts:3-12`): `userAgent: "*"`, `allow: "/"`, `disallow: ["/admin", "/api", "/onboarding"]`, sitemap em `https://kathapp.com.br/sitemap.xml`.
- **SEO `sitemap`** (`src/app/sitemap.ts:8-87`): 13 páginas estáticas com `priority` e `changeFrequency` configurados:
  - `/` (1.0, weekly), `/planos` (0.9, monthly), `/fitness` (0.9, weekly), `/loja` (0.8, weekly), `/calculadora` (0.7, monthly), `/kath-estetica` (0.8, weekly), `/kath-estetica/servicos` (0.8, weekly), `/kath-estetica/portfolio` (0.7, weekly), `/afiliados` (0.7, weekly), `/cupons` (0.7, weekly), `/desafio` (0.6, weekly), `/login` (0.3, yearly), `/registro` (0.4, yearly).
  - + URLs dinâmicas `/fitness/{id}` (0.6, monthly) por treino publicado.
  - Em caso de falha do Supabase, retorna apenas as estáticas (try/catch em `sitemap.ts:107`).
- **JSON-LD** (`src/app/(public)/page.tsx:77-121`): grafo Schema.org com `Organization` (sameAs Instagram/YouTube/TikTok), `WebSite`, `SoftwareApplication` (4 ofertas Free/Start/Pro/VIP) e `FAQPage` (3 perguntas/respostas).
- **OpenGraph / Twitter** (`page.tsx:62-74`): canonical `https://kathapp.com.br`, OG image `/og-image.png` (1200×630), Twitter card `summary_large_image`.
- **Mídia estática** referenciada na landing:
  - `/images/kath-walk.mp4` — vídeo do hero (`page.tsx:238`).
  - `/images/app-mockup.jpeg` — mockup do app na seção Features (`page.tsx:418`).
  - `/images/kath-avatar.jpg` — avatar da Kath na seção CTA (`page.tsx:629`).
  - `/icons/logo-navbar.png` — logo da nav e do footer (`page.tsx:201`, `page.tsx:682`).
  - `/icons/icon-512.png` — logo no JSON-LD (`page.tsx:85`).
- **Links externos** (sem tracking): `https://instagram.com/kathguedes` e `https://youtube.com/@kathguedes` no nav e footer.

## 7. Validações
- **N/A** — não há formulários nem inputs na landing. Toda conversão é via `<Link>` para `/registro` e `/login` (validação acontece nessas rotas, fora deste escopo).

## 8. Fluxos principais

### Fluxo: Visitante chega na home
1. Servidor renderiza `Home` (RSC) em `src/app/(public)/page.tsx:123`, que injeta `<script type="application/ld+json">` (page.tsx:127) e monta a árvore de seções.
2. Cliente recebe HTML; `LandingShell` (`landing-shell.tsx:12`) — `"use client"` — monta `Preloader`, `ScrollProgress` e `MouseGlow`.
3. `Preloader` (`preloader.tsx:5`) cobre a tela com animação 0%→100% por ~2.2 s, depois esmaece em 700 ms e é removido do DOM em 1.2 s.
4. Hero exibe vídeo `kath-walk.mp4` em loop muted autoplay; títulos animam com `title-rotate-in` (definido fora deste escopo, em CSS global).
5. À medida que o usuário rola, `ScrollProgress` atualiza a barra superior; `MouseGlow` segue o cursor (apenas em `lg:`).

### Fluxo: Visitante converte em assinante
1. Em qualquer CTA — Nav (`page.tsx:213`), Hero (`page.tsx:286`), KathEstetica (`page.tsx:576`), CTA final (`page.tsx:646`), `PlanCard` (`page.tsx:806`) — clica em "Assinar" / "Quero Começar" / "Eu Quero Entrar".
2. Navegação para `/registro` ou `/login` (handoff para o setor de Auth — não documentado aqui).

### Fluxo: Crawler indexa o site
1. Crawler bate em `https://kathapp.com.br/robots.txt` → handler em `src/app/robots.ts:3` retorna regras + ponteiro para sitemap.
2. Crawler bate em `https://kathapp.com.br/sitemap.xml` → handler async em `src/app/sitemap.ts:4` monta lista estática (13 URLs) + lê `workout_videos` publicados via Supabase admin client e concatena URLs dinâmicas.
3. Se a leitura do Supabase lançar exceção, o try/catch em `sitemap.ts:91-109` garante fallback só com estáticas (sem 500).

## 9. Observações (notas para Fase B — não auditar agora)
- Componentes `AnimatedCounter`, `Marquee`, `MagneticButton`, `Parallax`/`ScaleReveal`, `ScrollReveal`/`StaggerReveal`, `TextReveal`/`SplitTextReveal`, `TiltCard`, `HorizontalScroll` existem em `src/components/landing/` mas **não são importados** por `page.tsx` nem `landing-shell.tsx` na versão atual — código morto ou reservado. Verificar se há uso futuro planejado ou se podem ser removidos.
- Os números em `SocialProofSection` (`page.tsx:343-346`) — "351K", "2.847", "98%", "150+" — são strings hardcoded, não vêm do banco. Mesma situação para depoimentos (`page.tsx:452-454`) e itens da `MarqueeSection` (`page.tsx:314-323`).
- Comentário "coloque kath-avatar.jpg em /public/images/" (`page.tsx:626`) sugere que a configuração desse asset é responsabilidade manual; conferir se o arquivo existe (`public/images/kath-avatar.jpg`).
- O JSON-LD (`page.tsx:77-121`) embute preços fixos (R$19/R$39/R$99) e descrições dos planos. Está duplicado em relação ao `PricingSection` (`page.tsx:475-508`). Em mudanças de pricing, ambos precisam ser atualizados manualmente.
- O hostname `https://kathapp.com.br` está hardcoded em `robots.ts:10`, `sitemap.ts:5`, `page.tsx:62`, `page.tsx:66`, `page.tsx:84`, `page.tsx:91`, `page.tsx:99` etc. Não usa `env`/`NEXT_PUBLIC_*` — eventual mudança de domínio exige varredura manual.
- O sitemap usa `createAdminSupabaseClient()` (cliente com service-role) só para ler treinos publicados; uma leitura com client público poderia ser suficiente já que `is_published = true` é informação pública.
- `MarqueeSection` em `page.tsx:313` reimplementa o marquee inline em vez de reaproveitar o componente `Marquee` (`marquee.tsx:11`). Oportunidade de refator.
- `LandingShell` é client-side (`"use client"` em `landing-shell.tsx:1`). A página `Home` é RSC, mas ao envolvê-la em `LandingShell` os filhos passam por boundary client. As subseções permanecem renderizadas no servidor (RSC), apenas o shell é client.
- `priority` da `<Image>` do logo em `page.tsx:201` está marcado, garantindo LCP.
- Sem TODO/FIXME explícito na base do escopo (`grep` não foi necessário — leitura completa não revelou marcadores).

## 10. Referências

### Arquivos-chave
- `src/app/(public)/page.tsx:1-827` — home pública completa.
- `src/app/(public)/landing-shell.tsx:12` — wrapper client com Preloader/ScrollProgress/MouseGlow.
- `src/app/robots.ts:3` — regras de crawler.
- `src/app/sitemap.ts:4` — sitemap estático + dinâmico.
- `src/components/landing/preloader.tsx:5`
- `src/components/landing/mouse-glow.tsx:5`
- `src/components/landing/scroll-progress.tsx:5`
- `src/components/landing/animated-counter.tsx:13`
- `src/components/landing/horizontal-scroll.tsx:14`
- `src/components/landing/magnetic-button.tsx:11`
- `src/components/landing/marquee.tsx:11`
- `src/components/landing/parallax-image.tsx:12` (`Parallax`, `ScaleReveal`)
- `src/components/landing/scroll-reveal.tsx:14` (`ScrollReveal`, `StaggerReveal`)
- `src/components/landing/text-reveal.tsx:13` (`TextReveal`, `SplitTextReveal`)
- `src/components/landing/tilt-card.tsx:12`

### Migrations
- N/A — a landing não cria nem altera tabelas. A leitura em `sitemap.ts` consome `workout_videos` (migration coberta pelo agente de Fitness).

### Setores cruzados (NÃO documentar aqui)
- **Auth** (`/login`, `/registro`) — destinos dos CTAs da landing; tratada por outro agente.
- **Fitness/Treinos** (`/fitness`, `/fitness/{id}`, tabela `workout_videos`) — referenciada pelo `sitemap.ts`; documentada por outro agente.
- **Loja** (`/loja`) — referenciada pelo sitemap.
- **Cupons** (`/cupons`) — referenciada pelo sitemap.
- **Afiliados** (`/afiliados`) — referenciada pelo sitemap.
- **Calculadora** (`/calculadora`) — referenciada pelo sitemap.
- **Kath Estética Moto** (`/kath-estetica`, `/kath-estetica/servicos`, `/kath-estetica/portfolio`) — divulgada na home (seção `KathEsteticaSection` em `page.tsx:514`) e no sitemap; setor próprio.
- **Planos / Pricing** (`/planos`) — descritos visualmente em `PricingSection` (`page.tsx:461`); a lógica de assinatura (Asaas) é de outro agente.
- **Onboarding** (`/onboarding`) — bloqueado em `robots.ts:8`; setor próprio.
- **Admin** e **API** — bloqueados em `robots.ts:8`; setores próprios.
- **UI primitives** consumidos: `Button` (`src/components/ui/button.tsx`) e `Badge` (`src/components/ui/badge.tsx`) — biblioteca compartilhada.
- **Design tokens / animações CSS** (`text-gradient-pink`, `noise-overlay`, `neon-spot`, `animate-marquee`, `title-rotate-in`, `neon-drift`, `fade-y-in`, `footer-gradient`, classes `tr-*`, `sr-*`, `scale-reveal-*`) — definidos em `src/app/globals.css` (fora deste escopo).
