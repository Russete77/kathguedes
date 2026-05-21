/**
 * Camada plugável de OCR de placa.
 *
 * Hoje o projeto não tem provedor configurado, então `extractPlate` retorna
 * sempre `null` — a UI usa entrada manual como fallback.
 *
 * Para plugar um provedor real (Tesseract.js, Google Vision, AWS Textract),
 * implemente a interface `OCRProvider` em outro arquivo e injete via
 * `setOCRProvider()` no boot do app. Manter a fronteira aqui evita acoplar
 * a Server Action ao provedor.
 */

import { parsePlate } from "./plates";

export interface OCRProvider {
  /**
   * Recebe a imagem (Blob/File) e tenta extrair candidatos de placa.
   * Deve retornar strings brutas — `extractPlate` filtra e normaliza.
   */
  recognize(image: Blob): Promise<string[]>;
}

let provider: OCRProvider | null = null;

export function setOCRProvider(p: OCRProvider | null): void {
  provider = p;
}

export function hasOCRProvider(): boolean {
  return provider !== null;
}

/**
 * Tenta extrair uma placa válida da imagem.
 * Retorna a placa normalizada (ABC1D23) ou null se nenhum candidato bater.
 */
export async function extractPlate(image: Blob): Promise<string | null> {
  if (!provider) return null;
  try {
    const candidates = await provider.recognize(image);
    for (const raw of candidates) {
      const plate = parsePlate(raw);
      if (plate) return plate;
    }
    return null;
  } catch (err) {
    console.error("[ocr] recognize failed", err);
    return null;
  }
}
