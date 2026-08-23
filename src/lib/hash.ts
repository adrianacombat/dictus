/**
 * Calcula o hash SHA-256 de um arquivo inteiramente no navegador (Web Crypto API).
 *
 * PRINCÍPIO ARQUITETURAL INEGOCIÁVEL: o arquivo de áudio/vídeo NUNCA é
 * armazenado no servidor. Apenas este hash e o texto transcrito persistem
 * no banco de dados. O arquivo original passa direto do navegador para o
 * provedor de transcrição (via a Edge Function ia-gateway, que apenas
 * repassa os bytes sem gravá-los em disco/armazenamento).
 */
export async function sha256File(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Converte um File ou Blob (ex.: gravação ao vivo) em base64 puro (sem o prefixo data:...;base64,). */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
