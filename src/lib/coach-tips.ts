import "server-only";

/**
 * Extração de "dicas do profissional" a partir do vídeo do YouTube.
 *
 * Estratégia (ver decisão de produto, 2026-06):
 *  1) LEGENDA do YouTube (auto ou manual) — funciona em serverless (Vercel),
 *     sem baixar áudio. É a fonte primária.
 *  2) Resumo por IA (OpenAI) — transforma a transcrição crua nas dicas curtas
 *     de execução que aparecem pro aluno.
 *  3) Fallback MANUAL — se o vídeo não tiver legenda, a Kath digita as dicas no
 *     admin (sempre confiável).
 *
 * Whisper/STT a partir do áudio fica como evolução futura (precisa de um worker
 * fora da Vercel pra baixar o áudio — não cabe numa serverless function).
 *
 * Requer process.env.OPENAI_API_KEY (passo 2). O passo 1 não usa chave.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TIPS_MODEL || "gpt-4o-mini";

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Busca a transcrição da legenda de um vídeo do YouTube (prefere PT).
 * Retorna o texto cru, ou null se o vídeo não tiver legenda disponível.
 *
 * NOTA: depende do formato da página do YouTube (ytInitialPlayerResponse).
 * Se o YouTube mudar o HTML, ajustar o regex aqui. Em produção, validar com
 * alguns vídeos reais da Kath antes de confiar 100% no automático.
 */
export async function fetchYoutubeCaptions(youtubeId: string): Promise<string | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${youtubeId}&hl=pt`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Sem flag /s (dotAll) — [\s\S] cobre quebras de linha em targets < ES2018.
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var |<\/script>)/);
  if (!m) return null;

  let player: { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } };
  try {
    player = JSON.parse(m[1]);
  } catch {
    return null;
  }

  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const track = tracks.find((t) => t.languageCode?.startsWith("pt")) ?? tracks[0];
  if (!track?.baseUrl) return null;

  const capRes = await fetch(track.baseUrl);
  if (!capRes.ok) return null;
  const xml = await capRes.text();

  // Sem matchAll (ES2020) nem flag /s — usa exec em loop e [\s\S].
  const parts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(xml)) !== null) {
    const t = decodeEntities(mm[1]);
    if (t) parts.push(t);
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/**
 * Resume a transcrição crua em dicas curtas de execução, em PT-BR.
 * Retorna um bloco com itens "• ...".
 */
export async function summarizeCoachTips(
  transcript: string,
  exerciseName: string,
): Promise<string> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY não configurada no ambiente.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Você é personal trainer revisando a fala de um vídeo de treino. " +
            "Extraia APENAS as dicas práticas de execução, postura, respiração, " +
            "amplitude e segurança ditas no vídeo. Ignore saudações, marketing e " +
            "enrolação. Responda em PT-BR, com 3 a 6 itens curtos (máx ~12 palavras " +
            "cada), cada item começando com '• '. Não invente nada que não esteja na fala.",
        },
        {
          role: "user",
          content:
            `Exercício: ${exerciseName}\n\n` +
            `Transcrição do vídeo:\n${transcript.slice(0, 12000)}\n\n` +
            `Liste as dicas de execução e segurança mencionadas.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Pipeline completo: legenda → resumo. Lança erro claro se não houver legenda
 * (a UI então oferece o preenchimento manual).
 */
export async function generateCoachTipsFromYoutube(
  youtubeId: string,
  exerciseName: string,
): Promise<{ tips: string; source: "caption" }> {
  const transcript = await fetchYoutubeCaptions(youtubeId);
  if (!transcript) {
    throw new Error(
      "Vídeo sem legenda disponível no YouTube. Adicione as dicas manualmente.",
    );
  }
  const tips = await summarizeCoachTips(transcript, exerciseName);
  if (!tips) throw new Error("Não consegui extrair dicas da transcrição.");
  return { tips, source: "caption" };
}
