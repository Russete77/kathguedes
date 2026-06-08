import type { Metadata } from "next";
import { LegalPage, H, UL } from "../legal/legal-page";

export const metadata: Metadata = {
  title: "Cancelamento e Reembolso — KathApp",
  description: "Política de cancelamento e reembolso do KathApp: direito de arrependimento de 7 dias e reembolso proporcional.",
  alternates: { canonical: "https://www.kathguedes.com.br/cancelamento" },
};

export default function CancelamentoPage() {
  return (
    <LegalPage title="Política de Cancelamento e Reembolso" updatedAt="29 de maio de 2026">
      <p>
        Queremos que você se sinta seguro(a) ao assinar. Esta política explica, de forma transparente,
        como funcionam o cancelamento e o reembolso, em linha com o Código de Defesa do Consumidor (CDC).
      </p>

      <H>1. Arrependimento em 7 dias (reembolso integral)</H>
      <p>
        Por se tratar de contratação à distância, você pode desistir em até <strong>7 (sete) dias
        corridos</strong> a partir da confirmação do pagamento, com <strong>devolução integral</strong>
        do valor pago, sem necessidade de justificativa (art. 49 do CDC). Basta solicitar pelos canais
        abaixo.
      </p>

      <H>2. Cancelamento após os 7 dias</H>
      <p>
        Após o prazo de arrependimento, você pode cancelar a qualquer momento. Como os planos são
        contratados por período (semestral ou anual), aplica-se o seguinte:
      </p>
      <UL>
        <li><strong>PIX/boleto (recorrente):</strong> o cancelamento desliga a renovação automática. Você mantém o acesso até o fim do período já pago e não é cobrado de novo.</li>
        <li><strong>Cartão parcelado:</strong> reembolsamos de forma <strong>proporcional aos meses ainda não usufruídos</strong>, com o estorno das parcelas futuras correspondentes. Você mantém o acesso ao período já utilizado.</li>
      </UL>
      <p>
        Em resumo: você só paga pelo período que efetivamente utilizou. Não cobramos multa de
        cancelamento.
      </p>

      <H>3. Como cancelar</H>
      <p>Você pode solicitar o cancelamento por qualquer um destes canais:</p>
      <UL>
        <li>Pelo aplicativo, em Perfil &gt; Assinatura;</li>
        <li>Por e-mail: <a href="mailto:contato@kathguedes.com.br" className="text-pink underline">contato@kathguedes.com.br</a>.</li>
      </UL>

      <H>4. Prazos de reembolso</H>
      <UL>
        <li><strong>PIX/boleto:</strong> reembolso em até 10 dias úteis na mesma forma de pagamento ou via PIX informado.</li>
        <li><strong>Cartão de crédito:</strong> o estorno aparece na fatura conforme o prazo da operadora (geralmente em 1 a 2 ciclos de fatura).</li>
      </UL>

      <H>5. Observações</H>
      <UL>
        <li>Compras avulsas na loja seguem regras próprias informadas no momento da compra (inclui o direito de arrependimento de 7 dias para produtos).</li>
        <li>Valores de cashback recebidos sobre um pagamento reembolsado podem ser revertidos.</li>
        <li>Esta política não afeta direitos que a lei garante a você como consumidor.</li>
      </UL>
    </LegalPage>
  );
}
