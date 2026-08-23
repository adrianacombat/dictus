export type SegmentoUso =
  | 'juridico'
  | 'empresarial'
  | 'academico'
  | 'saude'
  | 'jornalismo'
  | 'pessoal'
  | 'outro';

export type TipoConta = 'individual' | 'equipe';

export type StatusConta = 'trial' | 'ativo' | 'suspenso' | 'cancelado';

export type PapelUsuario = 'owner' | 'membro' | 'gestor_plataforma';

export type Periodicidade = 'mensal' | 'anual';

export type StatusAssinatura = 'ativa' | 'cancelada' | 'expirada' | 'suspensa';

export interface Plano {
  id_plano: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  limite_minutos_transcricao: number;
  limite_documentos: number;
  limite_documentos_tecnicos: number;
  limite_mensagens_ia: number;
  limite_membros: number;
  ativo: boolean;
  ordem: number;
}

export interface Conta {
  id_conta: string;
  tipo_conta: TipoConta;
  nome: string;
  email_principal: string;
  segmento_uso: SegmentoUso;
  id_plano: string | null;
  status: StatusConta;
  trial_inicio: string;
  trial_fim: string | null;
  criado_em: string;
  atualizado_em: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  forma_pagamento: 'nenhuma' | 'stripe';
}

export interface Usuario {
  id_usuario: string;
  id_conta: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  profissao: string | null;
  registro_profissional: string | null;
  mfa_ativo: boolean;
  ativo: boolean;
  ultimo_login: string | null;
  criado_em: string;
}

export interface Assinatura {
  id_assinatura: string;
  id_conta: string;
  id_plano: string;
  periodicidade: Periodicidade;
  status: StatusAssinatura;
  data_inicio: string;
  data_proxima_cobranca: string | null;
  criado_em: string;
}

// ============================================================
// Créditos
// ============================================================
export type TipoCredito = 'minutos' | 'documentos' | 'documentos_tecnicos' | 'mensagens_ia';

export interface CreditoSaldo {
  id_conta: string;
  minutos_disponiveis: number;
  documentos_disponiveis: number;
  documentos_tecnicos_disponiveis: number;
  mensagens_ia_disponiveis: number;
  mes_referencia: string | null;
  atualizado_em: string;
}

export interface CreditoMovimento {
  id_movimento: number;
  id_conta: string;
  tipo: TipoCredito;
  quantidade: number;
  origem: string;
  id_referencia: string | null;
  criado_em: string;
}

export interface PacoteCredito {
  id_pacote: string;
  nome: string;
  tipo: TipoCredito | 'combo';
  quantidade: number;
  preco_brl: number;
  ativo: boolean;
  ordem: number;
}

export interface CompraCredito {
  id_compra: string;
  id_conta: string;
  id_pacote: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  origem_pagamento: 'manual_comprovante' | 'gateway';
  comprovante_url: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  respondido_por: string | null;
}

// ============================================================
// Projetos / Transcrição
// ============================================================
export interface Projeto {
  id_projeto: string;
  id_conta: string;
  nome: string;
  descricao: string | null;
  criado_em: string;
}

export type OrigemCaptura =
  | 'presencial'
  | 'presencial_video'
  | 'navegador_aba'
  | 'navegador_aba_video'
  | 'upload';

export type StatusTranscricao = 'na_fila' | 'processando' | 'concluido' | 'erro' | 'reprocessando';

export interface Transcricao {
  id_transcricao: string;
  id_conta: string;
  id_usuario: string;
  id_projeto: string | null;
  id_consentimento: string;
  titulo: string;
  participantes_texto: string | null;
  origem_captura: OrigemCaptura;
  qtd_interlocutores_informada: number | null;
  idioma: string;
  duracao_segundos: number | null;
  hash_arquivo_sha256: string | null;
  nome_arquivo_original: string | null;
  provedor_transcricao: string;
  provedor_job_id: string | null;
  status: StatusTranscricao;
  texto_corrido: string | null;
  texto_editado_manualmente: boolean;
  custo_usd: number | null;
  mensagem_erro: string | null;
  tentativas_reprocessamento: number;
  criado_em: string;
  concluido_em: string | null;
}

export interface TranscricaoInterlocutor {
  id_interlocutor: string;
  id_transcricao: string;
  rotulo_original: string;
  nome_atribuido: string | null;
  ordem: number;
}

export interface TranscricaoSegmento {
  id_segmento: number;
  id_transcricao: string;
  id_interlocutor: string | null;
  inicio_ms: number;
  fim_ms: number;
  texto: string;
  confianca: number | null;
  ordem: number;
}

// ============================================================
// Documentos
// ============================================================
export interface CategoriaDocumento {
  id_categoria: string;
  id_conta: string | null;
  nome: string;
  segmento: string;
}

export interface ModeloDocumento {
  id_modelo: string;
  id_conta: string | null;
  id_categoria: string;
  tipo_saida: string;
  descricao: string;
  conteudo_html: string | null;
  variaveis_disponiveis: string[] | null;
  ativo: boolean;
  criado_em: string;
}

export type StatusDocumento = 'rascunho_ia' | 'em_revisao' | 'aprovado' | 'exportado';

export interface DocumentoGerado {
  id_documento: string;
  id_conta: string;
  id_usuario: string;
  id_projeto: string | null;
  id_transcricao: string | null;
  id_modelo: string | null;
  id_categoria: string | null;
  tipo_saida: string;
  titulo: string;
  status: StatusDocumento;
  hash_arquivo_origem: string | null;
  criado_em: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
}

export interface DocumentoVersao {
  id_versao: string;
  id_documento: string;
  numero_versao: number;
  conteudo_html: string;
  gerado_por_ia: boolean;
  id_usuario_edicao: string | null;
  criado_em: string;
}

// ============================================================
// Assistente IA / Consumo
// ============================================================
export interface ChatMensagem {
  id_mensagem: string;
  id_conta: string;
  id_usuario: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  criado_em: string;
}

export interface ConsumoIaLog {
  id_consumo: number;
  id_conta: string;
  id_usuario: string;
  id_modelo_ia: string;
  finalidade: string;
  id_referencia: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo_usd: number | null;
  criado_em: string;
}

// ============================================================
// Notificações
// ============================================================
export type EscopoNotificacao = 'todos' | 'conta' | 'usuario';

export interface Notificacao {
  id_notificacao: string;
  escopo: EscopoNotificacao;
  id_conta: string | null;
  id_usuario_destino: string | null;
  titulo: string;
  corpo_html: string;
  criado_por: string | null;
  criado_em: string;
}

export interface NotificacaoLeitura {
  id_notificacao: string;
  id_usuario: string;
  lida_em: string;
}

// ============================================================
// Suporte
// ============================================================
export type TipoTicketSuporte = 'bug' | 'sugestao' | 'duvida';
export type StatusTicketSuporte = 'aberto' | 'em_andamento' | 'resolvido';

export interface SuporteTicket {
  id_ticket: string;
  id_conta: string;
  id_usuario_criador: string;
  titulo: string;
  tipo: TipoTicketSuporte;
  status: StatusTicketSuporte;
  criado_em: string;
  atualizado_em: string;
}

export interface SuporteMensagem {
  id_mensagem: string;
  id_ticket: string;
  id_usuario: string;
  conteudo: string;
  criado_em: string;
}

// ============================================================
// Prompts de IA (instruções editáveis pelo gestor)
// ============================================================
export interface PromptIA {
  id_prompt: string;
  tipo_saida: string;
  texto_prompt: string;
  modelo_ia: string;
  versao: number;
  ativo: boolean;
  criado_em: string;
}

// ============================================================
// Preços de provedores de IA
// ============================================================
export type UnidadePrecoIA = 'por_minuto' | 'por_1k_tokens_entrada' | 'por_1k_tokens_saida' | 'por_documento';

export interface PrecoProvedorIA {
  id_preco: string;
  provedor: string;
  modelo: string;
  unidade: UnidadePrecoIA;
  preco_usd: number;
  ativo: boolean;
  criado_em: string;
}
