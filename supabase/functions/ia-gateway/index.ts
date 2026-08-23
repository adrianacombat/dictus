// ia-gateway Edge Function
//
// PRINCÍPIO ARQUITETURAL INEGOCIÁVEL: este é o ÚNICO lugar do sistema que
// fala com provedores externos de IA (AssemblyAI para transcrição,
// Anthropic Claude para geração de texto). Nenhum outro componente
// (frontend ou outra function) deve chamar essas APIs diretamente.
//
// Ações suportadas (via body.action):
//   - iniciar_transcricao : recebe o áudio/vídeo em base64, repassa para a
//     AssemblyAI (sem gravar o arquivo em nenhum storage) e marca a
//     transcrição como "processando".
//   - verificar_transcricao : consulta o status do job na AssemblyAI e,
//     quando concluído, grava segmentos/interlocutores/texto e debita
//     créditos.
//   - gerar_documento : monta o prompt a partir do modelo + transcrição,
//     chama a Claude e grava o documento gerado, debitando créditos.
//   - chat : conversa livre com a Claude, debitando créditos de mensagens.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-5";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/** Cliente que atua com a identidade do usuário chamador (respeita RLS). */
function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function getCallingUser(authHeader: string) {
  const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) throw new Error("Usuário não autenticado.");
  return data.user;
}

async function getUsuarioEConta(authHeader: string, userId: string) {
  const supa = userClient(authHeader);
  const { data, error } = await supa
    .from("usuarios")
    .select("id_usuario, id_conta, nome")
    .eq("id_usuario", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Não foi possível identificar a conta do usuário.");
  return data;
}

// ============================================================
// AÇÃO: iniciar_transcricao
// ============================================================
async function iniciarTranscricao(authHeader: string, payload: any) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY não configurada. Adicione o segredo em Supabase → Edge Functions → Secrets.");
  }

  const { id_transcricao, arquivo_base64, idioma, qtd_interlocutores } = payload;
  if (!id_transcricao || !arquivo_base64) {
    throw new Error("id_transcricao e arquivo_base64 são obrigatórios.");
  }

  const user = await getCallingUser(authHeader);
  const { id_conta } = await getUsuarioEConta(authHeader, user.id);

  const supaAdmin = admin();

  // Confirma que a transcrição pertence à conta do usuário chamador
  const { data: transcricao, error: transErr } = await supaAdmin
    .from("transcricoes")
    .select("id_transcricao, id_conta, status")
    .eq("id_transcricao", id_transcricao)
    .maybeSingle();
  if (transErr || !transcricao || transcricao.id_conta !== id_conta) {
    throw new Error("Transcrição não encontrada para esta conta.");
  }

  // Checa saldo de créditos (minutos) antes de gastar com o provedor
  const { data: saldo } = await supaAdmin
    .from("credito_saldo")
    .select("minutos_disponiveis")
    .eq("id_conta", id_conta)
    .maybeSingle();
  if (!saldo || Number(saldo.minutos_disponiveis) <= 0) {
    throw new Error("Créditos de minutos de transcrição esgotados para esta conta.");
  }

  // Decodifica o base64 e repassa direto para a AssemblyAI — os bytes NUNCA
  // tocam armazenamento persistente, ficam só em memória neste request.
  const binary = Uint8Array.from(atob(arquivo_base64), (c) => c.charCodeAt(0));

  const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: ASSEMBLYAI_API_KEY },
    body: binary,
  });
  if (!uploadResp.ok) {
    throw new Error(`Falha ao enviar áudio para a AssemblyAI (${uploadResp.status}).`);
  }
  const { upload_url } = await uploadResp.json();

  const transcriptResp = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      speakers_expected: qtd_interlocutores || undefined,
      language_code: (idioma || "pt").startsWith("pt") ? "pt" : (idioma || "en"),
    }),
  });
  if (!transcriptResp.ok) {
    throw new Error(`Falha ao criar job de transcrição na AssemblyAI (${transcriptResp.status}).`);
  }
  const job = await transcriptResp.json();

  await supaAdmin
    .from("transcricoes")
    .update({ provedor_job_id: job.id, status: "processando" })
    .eq("id_transcricao", id_transcricao);

  return { id_transcricao, status: "processando", provedor_job_id: job.id };
}

// ============================================================
// AÇÃO: verificar_transcricao
// ============================================================
async function verificarTranscricao(authHeader: string, payload: any) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY não configurada.");
  }
  const { id_transcricao } = payload;
  const user = await getCallingUser(authHeader);
  const { id_conta } = await getUsuarioEConta(authHeader, user.id);

  const supaAdmin = admin();
  const { data: transcricao, error } = await supaAdmin
    .from("transcricoes")
    .select("*")
    .eq("id_transcricao", id_transcricao)
    .maybeSingle();
  if (error || !transcricao || transcricao.id_conta !== id_conta) {
    throw new Error("Transcrição não encontrada para esta conta.");
  }

  if (transcricao.status === "concluido" || transcricao.status === "erro") {
    return {
      id_transcricao,
      status: transcricao.status,
      texto_corrido: transcricao.texto_corrido,
      mensagem_erro: transcricao.mensagem_erro,
    };
  }

  if (!transcricao.provedor_job_id) {
    throw new Error("Esta transcrição ainda não foi enviada ao provedor.");
  }

  const resp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcricao.provedor_job_id}`, {
    headers: { authorization: ASSEMBLYAI_API_KEY },
  });
  if (!resp.ok) {
    throw new Error(`Falha ao consultar status na AssemblyAI (${resp.status}).`);
  }
  const job = await resp.json();

  if (job.status === "error") {
    await supaAdmin
      .from("transcricoes")
      .update({ status: "erro", mensagem_erro: job.error || "Erro desconhecido na transcrição." })
      .eq("id_transcricao", id_transcricao);
    return { id_transcricao, status: "erro", texto_corrido: null, mensagem_erro: job.error };
  }

  if (job.status !== "completed") {
    return { id_transcricao, status: "processando", texto_corrido: null, mensagem_erro: null };
  }

  // Concluído: grava interlocutores + segmentos + texto corrido
  const utterances: any[] = job.utterances || [];
  const rotulos = [...new Set(utterances.map((u) => u.speaker))];
  const interlocutorMap: Record<string, string> = {};

  for (let i = 0; i < rotulos.length; i++) {
    const { data: interlocutor } = await supaAdmin
      .from("transcricao_interlocutores")
      .insert({
        id_transcricao,
        rotulo_original: `Falante ${rotulos[i]}`,
        ordem: i,
      })
      .select("id_interlocutor")
      .single();
    if (interlocutor) interlocutorMap[rotulos[i]] = interlocutor.id_interlocutor;
  }

  if (utterances.length > 0) {
    const segmentos = utterances.map((u, idx) => ({
      id_transcricao,
      id_interlocutor: interlocutorMap[u.speaker] ?? null,
      inicio_ms: u.start,
      fim_ms: u.end,
      texto: u.text,
      confianca: u.confidence ?? null,
      ordem: idx,
    }));
    await supaAdmin.from("transcricao_segmentos").insert(segmentos);
  }

  const duracaoSegundos = Math.round((job.audio_duration as number) || 0);
  const custoUsd = duracaoSegundos > 0 ? (duracaoSegundos / 60) * 0.0021 : null; // ~US$0.15/hora Universal-2 + diarização

  await supaAdmin
    .from("transcricoes")
    .update({
      status: "concluido",
      texto_corrido: job.text,
      duracao_segundos: duracaoSegundos,
      custo_usd: custoUsd,
      concluido_em: new Date().toISOString(),
    })
    .eq("id_transcricao", id_transcricao);

  const minutosConsumidos = Math.max(1, Math.ceil(duracaoSegundos / 60));
  await supaAdmin.rpc("creditar_saldo", {
    p_id_conta: id_conta,
    p_tipo: "minutos",
    p_quantidade: -minutosConsumidos,
    p_origem: "consumo_transcricao",
    p_id_referencia: id_transcricao,
  });

  await supaAdmin.from("consumo_ia_log").insert({
    id_conta,
    id_usuario: user.id,
    id_modelo_ia: "assemblyai/universal-2",
    finalidade: "transcricao",
    id_referencia: id_transcricao,
    custo_usd: custoUsd,
  });

  return { id_transcricao, status: "concluido", texto_corrido: job.text, mensagem_erro: null };
}

// ============================================================
// Helper: chamada à Claude
// ============================================================
async function callClaude(systemPrompt: string, userPrompt: string): Promise<{ texto: string; tokensIn: number; tokensOut: number }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada. Adicione o segredo em Supabase → Edge Functions → Secrets.");
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Falha ao chamar a IA (${resp.status}): ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  const texto = (data.content || []).map((b: any) => b.text || "").join("\n").trim();
  return {
    texto,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

// ============================================================
// AÇÃO: gerar_documento
// ============================================================
async function gerarDocumento(authHeader: string, payload: any) {
  const { id_transcricao, id_modelo } = payload;
  if (!id_transcricao || !id_modelo) throw new Error("id_transcricao e id_modelo são obrigatórios.");

  const user = await getCallingUser(authHeader);
  const { id_conta } = await getUsuarioEConta(authHeader, user.id);
  const supaAdmin = admin();

  const { data: transcricao } = await supaAdmin
    .from("transcricoes")
    .select("*")
    .eq("id_transcricao", id_transcricao)
    .maybeSingle();
  if (!transcricao || transcricao.id_conta !== id_conta) throw new Error("Transcrição não encontrada.");
  if (transcricao.status !== "concluido") throw new Error("A transcrição ainda não foi concluída.");

  const { data: modelo } = await supaAdmin
    .from("modelos_documento")
    .select("*")
    .eq("id_modelo", id_modelo)
    .maybeSingle();
  if (!modelo || (modelo.id_conta !== null && modelo.id_conta !== id_conta)) {
    throw new Error("Modelo de documento não encontrado.");
  }

  const { data: saldo } = await supaAdmin
    .from("credito_saldo")
    .select("documentos_disponiveis")
    .eq("id_conta", id_conta)
    .maybeSingle();
  if (!saldo || Number(saldo.documentos_disponiveis) <= 0) {
    throw new Error("Créditos de documentos esgotados para esta conta.");
  }

  const { data: prompt } = await supaAdmin
    .from("prompts_ia")
    .select("texto_prompt")
    .eq("tipo_saida", modelo.tipo_saida)
    .eq("ativo", true)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dataHoje = new Intl.DateTimeFormat("pt-BR").format(new Date());
  const dataTranscricao = transcricao.concluido_em
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(transcricao.concluido_em))
    : dataHoje;
  const promptFinal = (prompt?.texto_prompt || "Gere o documento a partir da transcrição: {{transcricao.texto}}")
    .replaceAll("{{transcricao.texto}}", transcricao.texto_corrido || "")
    .replaceAll("{{participantes}}", transcricao.participantes_texto || "Não informado");

  const systemPrompt =
    "Você é um assistente de redação de documentos profissionais em português do Brasil. " +
    "Gere apenas o conteúdo do documento solicitado, em HTML simples (parágrafos <p>, títulos <h2>, listas quando fizer sentido). " +
    "Não invente fatos que não estejam na transcrição. " +
    "Se o documento for de natureza jurídica, nunca use o termo 'laudo pericial' — este é um documento técnico produzido por IA, não uma perícia judicial.";

  const { texto, tokensIn, tokensOut } = await callClaude(systemPrompt, promptFinal);

  const conteudoFinal = (modelo.conteudo_html || "<div>{{transcricao.texto}}</div>")
    .replaceAll("{{transcricao.texto}}", texto)
    .replaceAll("{{participantes}}", transcricao.participantes_texto || "Não informado")
    .replaceAll("{{data_hoje}}", dataHoje)
    .replaceAll("{{projeto.nome}}", "")
    .replaceAll("{{hash_arquivo}}", transcricao.hash_arquivo_sha256 || "Não disponível")
    .replaceAll("{{origem_captura}}", transcricao.origem_captura || "Não informado")
    .replaceAll("{{data_transcricao}}", dataTranscricao);

  const { data: documento, error: docErr } = await supaAdmin
    .from("documentos_gerados")
    .insert({
      id_conta,
      id_usuario: user.id,
      id_transcricao,
      id_modelo,
      id_categoria: modelo.id_categoria,
      tipo_saida: modelo.tipo_saida,
      titulo: `${modelo.descricao} — ${transcricao.titulo}`,
      status: "rascunho_ia",
    })
    .select("id_documento")
    .single();
  if (docErr || !documento) throw new Error("Falha ao salvar o documento gerado.");

  await supaAdmin.from("documentos_versoes").insert({
    id_documento: documento.id_documento,
    numero_versao: 1,
    conteudo_html: conteudoFinal,
    gerado_por_ia: true,
    id_usuario_edicao: user.id,
  });

  await supaAdmin.rpc("creditar_saldo", {
    p_id_conta: id_conta,
    p_tipo: "documentos",
    p_quantidade: -1,
    p_origem: "consumo_documento",
    p_id_referencia: documento.id_documento,
  });

  await supaAdmin.from("consumo_ia_log").insert({
    id_conta,
    id_usuario: user.id,
    id_modelo_ia: ANTHROPIC_MODEL,
    finalidade: "documento",
    id_referencia: documento.id_documento,
    tokens_input: tokensIn,
    tokens_output: tokensOut,
  });

  return { id_documento: documento.id_documento, conteudo_html: conteudoFinal };
}

// ============================================================
// AÇÃO: chat
// ============================================================
async function chat(authHeader: string, payload: any) {
  const { mensagem, historico } = payload;
  if (!mensagem) throw new Error("mensagem é obrigatória.");

  const user = await getCallingUser(authHeader);
  const { id_conta } = await getUsuarioEConta(authHeader, user.id);
  const supaAdmin = admin();

  const { data: saldo } = await supaAdmin
    .from("credito_saldo")
    .select("mensagens_ia_disponiveis")
    .eq("id_conta", id_conta)
    .maybeSingle();
  if (!saldo || Number(saldo.mensagens_ia_disponiveis) <= 0) {
    throw new Error("Créditos de mensagens de IA esgotados para esta conta.");
  }

  const historicoTexto = (historico || [])
    .slice(-10)
    .map((m: any) => `${m.papel === "user" ? "Usuário" : "Assistente"}: ${m.conteudo}`)
    .join("\n");

  const systemPrompt =
    "Você é o assistente de IA da plataforma de transcrição e geração de documentos. " +
    "Responda em português do Brasil, de forma direta e útil, sobre transcrições, documentos e uso da plataforma.";
  const userPrompt = historicoTexto ? `${historicoTexto}\nUsuário: ${mensagem}` : mensagem;

  const { texto, tokensIn, tokensOut } = await callClaude(systemPrompt, userPrompt);

  await supaAdmin.rpc("creditar_saldo", {
    p_id_conta: id_conta,
    p_tipo: "mensagens_ia",
    p_quantidade: -1,
    p_origem: "consumo_chat",
    p_id_referencia: null,
  });

  await supaAdmin.from("consumo_ia_log").insert({
    id_conta,
    id_usuario: user.id,
    id_modelo_ia: ANTHROPIC_MODEL,
    finalidade: "chat",
    tokens_input: tokensIn,
    tokens_output: tokensOut,
  });

  try {
    await supaAdmin.from("chat_mensagens").insert([
      { id_conta, id_usuario: user.id, papel: "user", conteudo: mensagem },
      { id_conta, id_usuario: user.id, papel: "assistant", conteudo: texto },
    ]);
  } catch {
    // tabela chat_mensagens pode ainda não existir nesta instância — não bloqueia a resposta
  }

  return { resposta: texto };
}

// ============================================================
// Roteador
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Cabeçalho Authorization ausente." }, 401);
  }

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case "iniciar_transcricao":
        return jsonResponse(await iniciarTranscricao(authHeader, payload));
      case "verificar_transcricao":
        return jsonResponse(await verificarTranscricao(authHeader, payload));
      case "gerar_documento":
        return jsonResponse(await gerarDocumento(authHeader, payload));
      case "chat":
        return jsonResponse(await chat(authHeader, payload));
      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
