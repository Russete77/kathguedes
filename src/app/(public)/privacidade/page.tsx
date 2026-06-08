import type { Metadata } from "next";
import { LegalPage, H, UL } from "../legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade (LGPD) — KathApp",
  description: "Como o KathApp coleta, usa e protege seus dados pessoais, incluindo dados de saúde, conforme a LGPD.",
  alternates: { canonical: "https://www.kathguedes.com.br/privacidade" },
};

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="29 de maio de 2026">
      <p>
        Esta Política descreve como tratamos seus dados pessoais no KathApp, em conformidade com a Lei
        Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). O controlador dos dados é Kath Guedes.
        Encarregado/contato: <a href="mailto:contato@kathguedes.com.br" className="text-pink underline">contato@kathguedes.com.br</a>.
      </p>

      <H>1. Dados que coletamos</H>
      <UL>
        <li><strong>Cadastro e conta:</strong> nome, e-mail, telefone/WhatsApp.</li>
        <li><strong>Pagamento:</strong> CPF/CNPJ e dados necessários à cobrança, processados pelo Asaas (não armazenamos o número completo do cartão).</li>
        <li><strong>Dados de saúde (sensíveis):</strong> ficha de anamnese e questionário PAR-Q+ — peso, medidas, histórico de saúde, lesões, hábitos, medicamentos. Coletados mediante o seu consentimento explícito para a finalidade de montar seu plano.</li>
        <li><strong>Uso da plataforma:</strong> treinos assistidos, progresso, interações e dados técnicos (dispositivo, logs).</li>
      </UL>

      <H>2. Para que usamos</H>
      <UL>
        <li>Fornecer o serviço, montar treino/dieta e dar acompanhamento;</li>
        <li>Processar pagamentos, prevenir fraudes e emitir documentos fiscais;</li>
        <li>Enviar comunicações sobre a sua conta e, com seu aceite, notificações e novidades;</li>
        <li>Melhorar a plataforma e cumprir obrigações legais.</li>
      </UL>

      <H>3. Bases legais</H>
      <p>
        Tratamos seus dados com base na <strong>execução do contrato</strong> (prestação do serviço), no
        <strong> consentimento</strong> (especialmente para os dados de saúde e comunicações de marketing),
        no <strong>cumprimento de obrigação legal</strong> e no <strong>legítimo interesse</strong> para
        segurança e melhoria, sempre respeitando seus direitos.
      </p>

      <H>4. Compartilhamento</H>
      <p>Compartilhamos dados apenas com parceiros necessários à operação:</p>
      <UL>
        <li><strong>Asaas</strong> — processamento de pagamentos;</li>
        <li><strong>Clerk</strong> — autenticação/login;</li>
        <li><strong>Supabase</strong> e <strong>Vercel</strong> — hospedagem e banco de dados;</li>
        <li><strong>YouTube</strong> — exibição dos vídeos incorporados.</li>
      </UL>
      <p>Não vendemos seus dados pessoais.</p>

      <H>5. Transferência internacional</H>
      <p>
        Alguns parceiros podem processar dados fora do Brasil. Nesses casos, adotamos salvaguardas para
        garantir um nível de proteção adequado, conforme a LGPD.
      </p>

      <H>6. Seus direitos (LGPD)</H>
      <p>Você pode, a qualquer momento, solicitar:</p>
      <UL>
        <li>confirmação e acesso aos seus dados;</li>
        <li>correção de dados incompletos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação;</li>
        <li>portabilidade e informação sobre compartilhamentos;</li>
        <li>revogação do consentimento e eliminação dos dados tratados sob consentimento.</li>
      </UL>
      <p>
        Para exercer seus direitos, escreva para{" "}
        <a href="mailto:contato@kathguedes.com.br" className="text-pink underline">contato@kathguedes.com.br</a>.
      </p>

      <H>7. Segurança e retenção</H>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger seus dados (controle de acesso,
        criptografia em trânsito, isolamento por usuário). Mantemos os dados pelo tempo necessário às
        finalidades e às obrigações legais; depois disso, são eliminados ou anonimizados.
      </p>

      <H>8. Cookies</H>
      <p>
        Utilizamos cookies essenciais para login e funcionamento e, quando aplicável, de medição. Você
        pode gerenciar cookies nas configurações do seu navegador.
      </p>

      <H>9. Menores</H>
      <p>
        A plataforma é destinada a maiores de 18 anos. Menores só podem utilizá-la com consentimento e
        assistência de um responsável legal.
      </p>

      <H>10. Alterações</H>
      <p>
        Podemos atualizar esta Política. Mudanças relevantes serão comunicadas pelo app ou e-mail.
      </p>
    </LegalPage>
  );
}
