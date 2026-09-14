/**
 * Serviço de upload de imagens usadas na finalização de chamados.
 *
 * Imagens são persistidas em tabela protegida por RLS. A URL de dados mantém
 * o conteúdo salvo legível sem depender de uma URL assinada que expire.
 */

import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadResult = {
  /** URL utilizável no atributo src do <img>. */
  url: string;
  /** Nome do arquivo enviado, quando disponível. */
  filename?: string;
  /** Se true, indica que a URL é temporária (blob:) e deve ser revogada. */
  isTemporary: boolean;
};

const temporaryUrls = new Set<string>();

export function validateImageFile(file: File): string | null {
  const mime = file.type?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return "Formato inválido. Envie PNG, JPG, WebP ou GIF.";
  }
  if (mime === "image/svg+xml") {
    return "Arquivos SVG não são permitidos.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Arquivo excede o limite de 10 MB.";
  }
  return null;
}

/**
 * Faz upload da imagem para o backend de finalização.
 * Retorna uma URL de dados durável somente depois da gravação no banco.
 */
export async function uploadFinalizationImage(file: File): Promise<UploadResult> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const { error: uploadError } = await (supabase as SupabaseClient).from("crm_editor_images").insert({filename:file.name,mime_type:file.type.toLowerCase(),data_url:url});
  if (uploadError) throw new Error("Não foi possível salvar a imagem no banco.");
  return { url, filename: file.name, isTemporary: false };
}

/** Revoga uma URL temporária criada por uploadFinalizationImage. */
export function revokeFinalizationImage(url: string) {
  if (temporaryUrls.has(url)) {
    URL.revokeObjectURL(url);
    temporaryUrls.delete(url);
  }
}

/** Revoga URLs temporárias que não aparecem mais em um HTML final. */
export function revokeUnusedFinalizationImages(html: string) {
  for (const url of Array.from(temporaryUrls)) {
    if (!html.includes(url)) {
      URL.revokeObjectURL(url);
      temporaryUrls.delete(url);
    }
  }
}
