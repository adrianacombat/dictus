import { supabase } from '@/lib/supabase';

/**
 * PRINCÍPIO ARQUITETURAL INEGOCIÁVEL: este é o ÚNICO ponto do frontend que
 * chama a Edge Function ia-gateway. Nenhum componente deve chamar a API da
 * AssemblyAI, Anthropic, OpenAI etc. diretamente — tudo passa por aqui, que
 * por sua vez é o único lugar no backend que fala com provedores de IA.
 */
async function invoke<T>(action: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ia-gateway', {
    body: { action, payload },
  });

  if (error) {
    let message = error.message || 'Falha ao comunicar com o serviço de IA.';
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.clone().json();
        if (body?.error) message = body.error;
      }
    } catch {
      // ignore parsing failure, keep default message
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export interface IniciarTranscricaoResponse {
  id_transcricao: string;
  status: string;
  provedor_job_id: string;
}

export function iniciarTranscricao(payload: {
  id_transcricao: string;
  arquivo_base64: string;
  nome_arquivo: string;
  idioma: string;
  qtd_interlocutores?: number | null;
}) {
  return invoke<IniciarTranscricaoResponse>('iniciar_transcricao', payload);
}

export interface VerificarTranscricaoResponse {
  id_transcricao: string;
  status: string;
  texto_corrido: string | null;
  mensagem_erro: string | null;
}

export function verificarTranscricao(id_transcricao: string) {
  return invoke<VerificarTranscricaoResponse>('verificar_transcricao', { id_transcricao });
}

export interface GerarDocumentoResponse {
  id_documento: string;
  conteudo_html: string;
}

export function gerarDocumento(payload: { id_transcricao: string; id_modelo: string }) {
  return invoke<GerarDocumentoResponse>('gerar_documento', payload);
}

export interface ChatResponse {
  resposta: string;
}

export function enviarMensagemChat(payload: {
  mensagem: string;
  historico: { papel: 'user' | 'assistant'; conteudo: string }[];
}) {
  return invoke<ChatResponse>('chat', payload);
}
