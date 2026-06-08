-- Seed dos lembretes recorrentes definidos pela EQUIPE (sistema notification_schedules).
-- O cron /api/cron/wellness-reminder (1x/hora) dispara estes schedules.
-- Idempotente por slug. Rode no SQL Editor do Supabase OU recrie em /admin/push/schedules.
--
-- Cadência definida:
--   • Hidratação: a cada 3h (09, 12, 15, 18, 21) — só assinatura ativa (gate no cron).
--   • Motivacional: 2x/semana (seg e sex, 08:00) — gate de dia no cron; usa o vídeo do dia.

insert into notification_schedules
  (slug, title, body, icon, url, times, eligible_plans, default_enabled, category, sort_order, is_active, description)
values
  (
    'hidratacao',
    'Hora de hidratar',
    'Beba água — hidratação é parte do treino e da recuperação.',
    'Droplets',
    '/perfil',
    array['09:00','12:00','15:00','18:00','21:00']::time[],
    array[]::text[],            -- todos os planos (assinatura ativa é exigida no cron)
    true,                       -- ligado por padrão (user pode desligar no perfil)
    'hidratacao',
    1,
    true,
    'Lembrete de hidratação a cada 3h, das 9h às 21h.'
  ),
  (
    'motivacional',
    'Motivação do dia',
    'Seu vídeo do dia chegou. Bora?',  -- título/corpo reais vêm do vídeo do dia (cron sobrescreve)
    'PlayCircle',
    '/motivacional',
    array['08:00']::time[],
    array[]::text[],
    true,
    'motivacional',
    2,
    true,
    'Vídeo motivacional 2x/semana (segunda e sexta, 8h). Cadência controlada no cron.'
  )
on conflict (slug) do update set
  times        = excluded.times,
  category     = excluded.category,
  icon         = excluded.icon,
  url          = excluded.url,
  is_active    = excluded.is_active,
  updated_at   = now();
