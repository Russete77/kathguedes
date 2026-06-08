/**
 * Extrai o ID do vídeo do YouTube de qualquer formato:
 * - dQw4w9WgXcQ
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://youtube.com/shorts/dQw4w9WgXcQ
 */
export function extractYoutubeId(input: string): string {
  if (!input) return "";

  // Já é um ID puro (11 chars alfanuméricos)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  try {
    const url = new URL(input.trim());

    // youtu.be/ID
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1);
    }

    // youtube.com/watch?v=ID
    if (url.searchParams.has("v")) {
      return url.searchParams.get("v") || "";
    }

    // youtube.com/embed/ID ou youtube.com/shorts/ID
    const match = url.pathname.match(/\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[2];
    }
  } catch {
    // Não é URL — tentar extrair ID de qualquer string
    const match = input.match(/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return input.trim();
}

/**
 * Gera URL do thumbnail do YouTube.
 * Tenta maxresdefault, fallback pra hqdefault.
 */
export function youtubeThumbnail(youtubeId: string, quality: "maxres" | "hq" | "mq" = "hq"): string {
  const qualityMap = {
    maxres: "maxresdefault",
    hq: "hqdefault",
    mq: "mqdefault",
  };
  return `https://img.youtube.com/vi/${youtubeId}/${qualityMap[quality]}.jpg`;
}
