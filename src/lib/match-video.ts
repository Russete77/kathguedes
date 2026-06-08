/**
 * Casamento exercício ↔ vídeo da biblioteca por similaridade de nome.
 *
 * Usado para sugerir automaticamente o vídeo de execução de um exercício a
 * partir do título dos vídeos cadastrados em `workout_videos`. A mesma lógica
 * é replicada em SQL (pg_trgm) na migration de auto-vínculo, mas aqui roda no
 * client para pré-selecionar o vídeo no formulário do catálogo.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras genéricas que não ajudam a distinguir o exercício.
const STOP = new Set([
  "de", "da", "do", "com", "sem", "na", "no", "e", "ou", "para",
  "treino", "exercicio", "exercicios", "video", "kath", "guedes",
  "serie", "series", "reps", "completo", "intenso", "leve",
  "45", "90", "graus", "maquina",
]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export interface VideoOption {
  id: string;
  title: string;
  category?: string;
}

/**
 * Retorna o id do vídeo que melhor casa com o nome do exercício, ou null se
 * nenhum atingir o limiar mínimo de similaridade.
 *
 * Score = (tokens em comum) / (tokens do nome do exercício). Empate é
 * desempatado pelo título mais curto (mais específico).
 */
export function bestVideoMatch(
  exerciseName: string,
  videos: VideoOption[],
  minScore = 0.5,
): string | null {
  const exTokens = tokens(exerciseName);
  if (exTokens.length === 0 || videos.length === 0) return null;

  let bestId: string | null = null;
  let bestScore = 0;
  let bestLen = Infinity;

  for (const v of videos) {
    const vTokens = new Set(tokens(v.title));
    if (vTokens.size === 0) continue;
    const common = exTokens.filter((t) => vTokens.has(t)).length;
    const score = common / exTokens.length;
    if (
      score > bestScore ||
      (score === bestScore && v.title.length < bestLen)
    ) {
      bestScore = score;
      bestId = v.id;
      bestLen = v.title.length;
    }
  }

  return bestScore >= minScore ? bestId : null;
}
