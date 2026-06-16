/**
 * Normalização de URLs de imagem coladas no admin.
 *
 * Links de compartilhamento do Google Drive NÃO servem a imagem crua:
 *  - .../file/d/<ID>/view?usp=sharing  → é uma PÁGINA HTML, não a imagem
 *  - .../uc?export=view&id=<ID>        → redireciona / é bloqueado p/ hotlink
 * O optimizer do Next (/_next/image) então responde 400 (host não permitido)
 * ou a imagem simplesmente não carrega.
 *
 * Esta função extrai o ID do arquivo e devolve a URL do CDN de imagens do
 * Google (lh3.googleusercontent.com/d/<ID>), que aceita hotlink para arquivos
 * com compartilhamento "qualquer pessoa com o link". URLs que não são do Drive
 * passam inalteradas.
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;
  const id = extractDriveId(url);
  return id ? `https://lh3.googleusercontent.com/d/${id}` : url;
}

function extractDriveId(url: string): string | null {
  if (!/drive\.google\.com|docs\.google\.com/.test(url)) return null;
  // .../file/d/<ID>/view  ou  .../d/<ID>
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  // ...?id=<ID>  (uc?export=view&id= / open?id= / uc?id=)
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParam) return idParam[1];
  return null;
}
