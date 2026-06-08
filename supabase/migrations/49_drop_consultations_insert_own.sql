-- 49_drop_consultations_insert_own.sql
-- Remove a auto-concessão de consultoria (produto pago) via PostgREST.
--
-- A policy consultations_insert_own permitia que qualquer 'authenticated'
-- inserisse a PRÓPRIA consultoria (qualquer package_type / valid_until) sem
-- nenhum gate de pagamento. Consultoria é entitlement de plano (criada pelo
-- webhook Asaas em ensureConsultationForTier, e pelas actions admin, ambos via
-- service_role). O usuário nunca precisa inserir consultoria pelo client.
--
-- Mantemos consultations_select_own e consultations_update_own (o aluno lê e
-- preenche anamnese na própria consultoria). Só o INSERT do usuário sai.

drop policy if exists consultations_insert_own on public.consultations;
