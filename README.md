# KathApp

App oficial de **Kath Guedes** — treinos exclusivos, consultoria personalizada, loja e cupons.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js Server Actions + API Routes
- **Database:** Supabase (PostgreSQL) com RLS
- **Auth:** Clerk (integração nativa com Supabase)
- **Pagamentos:** Asaas (PIX, boleto, cartão)
- **Push:** Web Push API (VAPID)
- **Deploy:** Vercel
- **PWA:** Service Worker nativo

## Setup Local

```bash
# 1. Clonar e instalar
git clone <repo>
cd kathapp
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Preencher com suas chaves (Clerk, Supabase, Asaas, VAPID)

# 3. Rodar migrations no Supabase
# (via Supabase Dashboard ou CLI)

# 4. Iniciar dev server
npm run dev
```

## Estrutura

```
src/
├── app/
│   ├── (app)/         # Rotas autenticadas (fitness, loja, chat, etc.)
│   ├── (auth)/        # Login e registro (Clerk)
│   ├── (public)/      # Landing page
│   ├── admin/         # Painel admin (role: org:admin)
│   └── api/           # API routes (webhook, push, etc.)
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── fitness/       # Componentes de treino
│   ├── moto/          # Componentes de cupons/afiliados
│   └── layout/        # Navbar, notification bell
├── lib/
│   ├── supabase/      # Clients (server, client, types)
│   ├── asaas/         # Pagamentos (client, webhook, config)
│   ├── push/          # Web Push
│   ├── validations.ts # Zod schemas
│   ├── notifications.ts
│   └── env.ts         # Env validation
├── constants/         # Shared constants
└── hooks/             # Custom React hooks
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npx vitest` | Rodar testes |
