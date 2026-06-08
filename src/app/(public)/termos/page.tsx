import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H, UL } from "../legal/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso — KathApp",
  description: "Termos de Uso do KathApp (Kath Guedes): regras de assinatura, pagamento, conteúdo e responsabilidades.",
  alternates: { canonical: "https://www.kathguedes.com.br/termos" },
};

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="29 de maio de 2026">
      <p>
        Estes Termos de Uso regem o acesso e a utilização do aplicativo e site KathApp
        (&quot;Plataforma&quot;), operado por Kath Guedes (&quot;nós&quot;). Ao criar uma conta ou assinar
        um plano, você declara que leu, entendeu e concorda com estes Termos e com a nossa{" "}
        <Link href="/privacidade" className="text-pink underline">Política de Privacidade</Link>.
      </p>

      <H>1. Quem pode usar</H>
      <p>
        Você deve ter 18 anos ou mais, ou estar autorizado e assistido por um responsável legal.
        As informações de cadastro devem ser verdadeiras, completas e atualizadas.
      </p>

      <H>2. O que oferecemos</H>
      <p>A Plataforma disponibiliza, conforme o plano contratado:</p>
      <UL>
        <li>Biblioteca de vídeos de treino;</li>
        <li>Consultoria com treino e dieta personalizados (planos superiores);</li>
        <li>Calculadora de macros, cupons, cashback e loja;</li>
        <li>Canais de acompanhamento (chat) nos planos aplicáveis.</li>
      </UL>
      <p>
        Os recursos de cada plano são informados na página de planos e podem ser ajustados para
        melhoria do serviço, sem redução relevante do que foi contratado.
      </p>

      <H>3. Conta e segurança</H>
      <p>
        A conta é pessoal e intransferível. Você é responsável por manter a confidencialidade das
        suas credenciais e por toda atividade realizada na sua conta. Avise-nos imediatamente em
        caso de uso não autorizado.
      </p>

      <H>4. Planos, preços e pagamento</H>
      <UL>
        <li>Os planos são contratados em ciclo <strong>semestral (6 meses)</strong> ou <strong>anual (12 meses)</strong>.</li>
        <li>O pagamento pode ser feito à vista (PIX ou boleto) ou parcelado no cartão de crédito (em até 6x no semestral e 12x no anual).</li>
        <li>No PIX/boleto, a assinatura é recorrente e <strong>renova automaticamente</strong> ao fim do ciclo, salvo cancelamento. No cartão parcelado, não há renovação automática.</li>
        <li>O processamento de pagamentos é feito pelo parceiro Asaas; não armazenamos os dados completos do seu cartão.</li>
        <li>O acesso pago é liberado após a confirmação do pagamento.</li>
      </UL>
      <p>
        O cancelamento e o reembolso são tratados na{" "}
        <Link href="/cancelamento" className="text-pink underline">Política de Cancelamento e Reembolso</Link>.
      </p>

      <H>5. Conteúdo e propriedade intelectual</H>
      <p>
        Todo o conteúdo da Plataforma — vídeos, treinos, planos, textos, marca e identidade visual —
        pertence a Kath Guedes ou a seus licenciadores e é protegido por lei. É concedida a você uma
        licença pessoal, limitada e não exclusiva de uso enquanto durar a assinatura. É proibido
        copiar, redistribuir, revender, gravar ou compartilhar o conteúdo fora da Plataforma.
      </p>

      <H>6. Uso adequado</H>
      <p>Você concorda em não:</p>
      <UL>
        <li>compartilhar a conta ou as credenciais com terceiros;</li>
        <li>tentar burlar limites de plano, segurança ou cobrança;</li>
        <li>usar a Plataforma para fins ilícitos ou que violem direitos de terceiros.</li>
      </UL>

      <H>7. Saúde e isenção</H>
      <p>
        O conteúdo é informativo e de condicionamento físico e <strong>não substitui avaliação,
        diagnóstico ou acompanhamento médico</strong>. Antes de iniciar, você preenche o questionário
        de prontidão (PAR-Q+) e a ficha de anamnese; é sua responsabilidade fornecer informações
        verdadeiras e buscar liberação médica quando indicado. A prática de exercícios envolve riscos
        inerentes, e você assume a responsabilidade pela execução adequada e pela omissão de
        informações de saúde.
      </p>

      <H>8. Limitação de responsabilidade</H>
      <p>
        A Plataforma é fornecida &quot;no estado em que se encontra&quot;. Na máxima extensão permitida em
        lei, não nos responsabilizamos por danos indiretos, lucros cessantes ou por indisponibilidades
        decorrentes de terceiros (provedores de hospedagem, pagamento, internet). Nada nestes Termos
        limita direitos que você tenha como consumidor pelo Código de Defesa do Consumidor.
      </p>

      <H>9. Alterações</H>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas pelo app ou e-mail. O
        uso continuado após a vigência das alterações representa concordância.
      </p>

      <H>10. Contato e foro</H>
      <p>
        Dúvidas: <a href="mailto:contato@kathguedes.com.br" className="text-pink underline">contato@kathguedes.com.br</a>.
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor
        para dirimir eventuais controvérsias.
      </p>
    </LegalPage>
  );
}
