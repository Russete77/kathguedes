# Setup do Webhook Clerk — Dev + Prod

Guia passo-a-passo pra ligar o endpoint `POST /api/webhook/clerk` que sincroniza usuários do Clerk com a tabela `profiles` do Supabase.

**Implementação:** `src/app/api/webhook/clerk/route.ts` (já existe — usa `svix.Webhook.verify()` com fallback seguro pra dev).

**Eventos tratados:**
- `user.created` → upsert em `profiles` + notifica admins + push de boas-vindas
- `user.deleted` → soft-delete (anonimiza nome/avatar/phone/cpf, cancela subscription, mantém histórico financeiro)
- Outros eventos → 200 OK silencioso (Clerk não retenta)

---

## ⚠️ Antes de tudo: dev e prod são DUAS instâncias separadas

No painel do Clerk, você tem duas instâncias da app (atrás do seletor superior esquerdo):

- **Development** — onde você testa local (chaves `pk_test_…` e `sk_test_…`)
- **Production** — instância live (chaves `pk_live_…` e `sk_live_…`)

Cada instância tem o **próprio Signing Secret**. Você vai criar **dois endpoints**: um em cada instância. Não reusa.

---

## Parte 1 — Webhook em Dev (com ngrok)

### 1.1. Instalar ngrok
```powershell
# Windows (Chocolatey)
choco install ngrok

# ou baixar de https://ngrok.com/download
```

Cria conta gratuita em https://dashboard.ngrok.com/signup, copia o authtoken da página inicial e roda uma vez:
```powershell
ngrok config add-authtoken SEU_TOKEN_AQUI
```

### 1.2. Reservar um domínio estático grátis
ngrok dá 1 domínio estático grátis por conta. **Use ele** — assim você não precisa atualizar o endpoint no Clerk Dashboard toda vez que reinicia o ngrok.

1. https://dashboard.ngrok.com/domains → **+ New Domain** → cria algo tipo `kathapp-dev.ngrok-free.app`
2. Anota a URL.

### 1.3. Subir o tunnel apontando pro Next.js
Com o `npm run dev` rodando (na porta 3000), em **outro terminal**:
```powershell
ngrok http --url=kathapp-dev.ngrok-free.app 3000
```

Verifica que abriu: `https://kathapp-dev.ngrok-free.app` deve responder a home do kathapp.

### 1.4. Criar o endpoint no Clerk (instância Development)
1. https://dashboard.clerk.com → seleciona **Development** no topo
2. **Configure → Webhooks → + Add Endpoint**
3. **Endpoint URL:** `https://kathapp-dev.ngrok-free.app/api/webhook/clerk`
4. **Subscribe to events:** marca pelo menos `user.created` e `user.deleted` (`user.updated` é opcional)
5. **Create**
6. Na tela do endpoint criado, clica no **olhinho** ao lado de **Signing Secret** e copia (formato `whsec_...`)

### 1.5. Cadastrar no `.env.local`
```bash
# adicionar no .env.local
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

Reinicia o `npm run dev` (Next não pega env nova em hot reload).

### 1.6. Testar
No painel do Clerk → endpoint → aba **Testing**:
1. Em **Select event**, escolhe `user.created`
2. **Send Example**
3. Em **Message Attempts** confirma `Status: Succeeded`
4. No terminal do `npm run dev`, deve aparecer log do upsert no Supabase (sem erro)
5. Confere no Supabase: `select id, full_name, plan_tier from profiles order by created_at desc limit 5;`

**Se aparecer Failed:**
- Abre o evento → **Webhook Attempts** → seta a setinha → vê o status code + corpo da resposta
- 401 = `CLERK_WEBHOOK_SECRET` não bateu (env errada ou dev não reiniciou)
- 400 = JSON malformado (raro)
- 500 = erro no Supabase (RLS? service role faltando?)

### 1.7. Teste end-to-end
- No app local, acessa `/registro` → cria conta nova
- O webhook dispara `user.created` automaticamente
- Confere no painel Clerk → endpoint → **Message Attempts** que tem 200 OK
- Confere no Supabase que o profile foi criado

---

## Parte 2 — Webhook em Prod (Vercel + domínio kathguedes.com.br)

> Faça isso **depois** que o deploy na Vercel estiver no ar e o domínio resolvendo.

### 2.1. Confirma que o endpoint público responde
```powershell
curl -X POST https://kathguedes.com.br/api/webhook/clerk -d "{}" -H "Content-Type: application/json"
# Deve retornar: {"error":"Unauthorized"}  ← isso é BOM (Svix sem headers)
```

### 2.2. Criar o endpoint no Clerk (instância Production)
1. https://dashboard.clerk.com → seleciona **Production** no topo
2. **Configure → Webhooks → + Add Endpoint**
3. **Endpoint URL:** `https://kathguedes.com.br/api/webhook/clerk`
   *(use o canonical — se www é o canônico do seu site, use `https://www.kathguedes.com.br/...`)*
4. **Subscribe to events:** mesmos eventos do dev (`user.created`, `user.deleted`, opcional `user.updated`)
5. **Create**
6. Copia o **Signing Secret** (formato `whsec_...`) — **este é diferente do de dev**

### 2.3. Cadastrar na Vercel
1. Vercel Dashboard → projeto **kathapp** → **Settings → Environment Variables**
2. **Add New**
   - Name: `CLERK_WEBHOOK_SECRET`
   - Value: `whsec_...` (o de prod)
   - Environments: marca **só Production** (não preview, não development)
3. **Save**
4. **Redeploy** (Deployments → último deploy → ⋯ → Redeploy) — env nova não vale pro deploy ativo, só pros próximos

### 2.4. Testar prod
No Clerk Dashboard (Production) → endpoint → aba **Testing**:
1. `user.created` → **Send Example**
2. Confere **Message Attempts: Succeeded**
3. Confere no **Supabase Production** que um profile com id mock apareceu (depois pode deletar pra limpar)

### 2.5. Teste end-to-end de prod
- Acessa `https://kathguedes.com.br/registro` em uma janela anônima
- Cria conta com email descartável
- Confere no painel Clerk Production → **Users** que apareceu
- Confere no painel Clerk Production → endpoint → **Message Attempts** com 200 OK
- Confere no Supabase Production que o profile foi criado

---

## Parte 3 — Eventos opcionais e gotchas

### Quais eventos assinar?
| Evento | Assina? | Por quê |
|---|---|---|
| `user.created` | **Sim** | Cria profile no Supabase |
| `user.deleted` | **Sim** | Soft-delete + cancela subscription |
| `user.updated` | Opcional | Sincronizar nome/email se editado fora do app (atualmente o código ignora — retorna 200) |
| `session.*` | Não | Tráfego enorme, sem uso |
| `organization.*` | Não | KathApp não usa orgs |
| `email.*` | Não | Sem uso |
| `sms.*` | Não | Sem uso |

### Idempotência
O Clerk **retenta com exponential backoff** se você devolver não-2xx ou demorar mais de 15s. O handler atual já é idempotente:
- `user.created` usa `upsert` com `ignoreDuplicates: true`
- `user.deleted` é um `update` (rodar duas vezes não tem efeito)

Se quiser idempotência mais forte (no padrão do webhook do Asaas que registra `webhook_events`), pode replicar o mesmo `(payment_id:event) → UNIQUE` mas com `(svix-id) → UNIQUE`. Não é crítico.

### Middleware Clerk não bloqueia
O `src/middleware.ts` atual **não inclui `/api/webhook`** em `isProtectedRoute`, então a rota é pública por padrão — exatamente como a doc Clerk recomenda (webhook não tem sessão).

### "Cannot connect to the host"
Se o ngrok mostrar erro 502 ou 504 no Clerk:
- Confirma que `npm run dev` está rodando na 3000
- Confirma que `ngrok http --url=… 3000` está apontando pra mesma porta
- Tenta acessar `https://kathapp-dev.ngrok-free.app` no browser — deve ver a home do KathApp

### Erro 401 persistente
- Reinicia `npm run dev` (envs novas exigem restart)
- Confirma que o secret no `.env.local` é da **mesma instância** do endpoint (Development, não Production)
- Confirma que o `.env.local` **não** tem aspas em volta do valor: `CLERK_WEBHOOK_SECRET=whsec_xxx` (não `="whsec_xxx"`)

### Reprocessar evento perdido
No painel Clerk → endpoint → **Message Attempts**:
- Clica no evento que falhou
- Botão **Replay** no canto superior direito
- Útil pra reprocessar quando você corrige um bug no handler

---

## Parte 4 — Atualizar `.env.example`

O `.env.example` atual **não menciona** `CLERK_WEBHOOK_SECRET`. Adiciona junto das outras chaves Clerk:

```diff
 # ── Clerk ──
 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
 CLERK_SECRET_KEY=sk_test_...
+# Signing Secret do endpoint webhook (Clerk Dashboard → Webhooks → endpoint)
+CLERK_WEBHOOK_SECRET=whsec_...
 NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
```

---

## Checklist final

**Dev:**
- [ ] ngrok instalado + authtoken configurado
- [ ] Domínio estático grátis criado (`*.ngrok-free.app`)
- [ ] Endpoint criado na instância **Development** do Clerk
- [ ] `CLERK_WEBHOOK_SECRET` adicionado ao `.env.local`
- [ ] `npm run dev` reiniciado
- [ ] Teste "Send Example" deu 200
- [ ] Criar conta nova em `/registro` populou `profiles` no Supabase

**Prod:**
- [ ] Domínio kathguedes.com.br resolvendo SSL na Vercel
- [ ] Endpoint criado na instância **Production** do Clerk
- [ ] `CLERK_WEBHOOK_SECRET` (valor diferente de dev) adicionado na Vercel scope=Production
- [ ] Redeploy disparado após adicionar env
- [ ] Teste "Send Example" em Production deu 200
- [ ] Criar conta de teste no domínio real populou `profiles` no Supabase Production
- [ ] `.env.example` atualizado e commitado

---

**Refs oficiais (verificadas em 13/05/2026):**
- [Clerk Docs — Sync data with webhooks](https://clerk.com/docs/guides/development/webhooks/syncing) (atualizada 06/05/2026)
- [Clerk Docs — Webhooks overview](https://clerk.com/docs/guides/development/webhooks/overview)
- [Clerk Docs — Debug webhooks](https://clerk.com/docs/webhooks/debug-your-webhooks)
- [ngrok — Clerk integration](https://ngrok.com/docs/integrations/webhooks/clerk-webhooks)
