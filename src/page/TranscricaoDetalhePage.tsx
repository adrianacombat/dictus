import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { verificarTranscricao } from '@/lib/iaGateway';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type {
  CategoriaDocumento,
  ModeloDocumento,
  Transcricao,
  TranscricaoInterlocutor,
  TranscricaoSegmento,
} from '@/types/database';
import { ArrowLeft, RefreshCw, FileText, Users, ShieldCheck, Save } from 'lucide-react';

interface ModeloComCategoria extends ModeloDocumento {
  categorias_documento?: CategoriaDocumento | null;
}

function formatarTimestamp(ms: number): string {
  const totalSegundos = Math.floor(ms / 1000);
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function TranscricaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { conta } = useAuth();
  const [transcricao, setTranscricao] = useState<Transcricao | null>(null);
  const [segmentos, setSegmentos] = useState<TranscricaoSegmento[]>([]);
  const [interlocutores, setInterlocutores] = useState<TranscricaoInterlocutor[]>([]);
  const [nomesRascunho, setNomesRascunho] = useState<Record<string, string>>({});
  const [salvandoNomes, setSalvandoNomes] = useState(false);
  const [modelos, setModelos] = useState<ModeloComCategoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [{ data: t }, { data: segs }, { data: interls }] = await Promise.all([
      supabase.from('transcricoes').select('*').eq('id_transcricao', id).maybeSingle(),
      supabase.from('transcricao_segmentos').select('*').eq('id_transcricao', id).order('ordem'),
      supabase.from('transcricao_interlocutores').select('*').eq('id_transcricao', id).order('ordem'),
    ]);
    setTranscricao(t as Transcricao | null);
    setSegmentos((segs as TranscricaoSegmento[]) || []);
    const listaInterl = (interls as TranscricaoInterlocutor[]) || [];
    setInterlocutores(listaInterl);
    setNomesRascunho((prev) => {
      const base = { ...prev };
      for (const i of listaInterl) {
        if (base[i.id_interlocutor] === undefined) {
          base[i.id_interlocutor] = i.nome_atribuido || i.rotulo_original;
        }
      }
      return base;
    });
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    supabase
      .from('modelos_documento')
      .select('*, categorias_documento(*)')
      .eq('ativo', true)
      .then(({ data }) => setModelos((data as ModeloComCategoria[]) || []));
  }, []);

  useEffect(() => {
    if (!transcricao || transcricao.status !== 'processando') return;
    const interval = setInterval(async () => {
      try {
        await verificarTranscricao(transcricao.id_transcricao);
        carregar();
      } catch {
        // ignora falhas de polling isoladas, tenta de novo no próximo ciclo
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [transcricao, carregar]);

  async function handleVerificarAgora() {
    if (!transcricao) return;
    setVerificando(true);
    setErro(null);
    try {
      await verificarTranscricao(transcricao.id_transcricao);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao verificar status.');
    } finally {
      setVerificando(false);
    }
  }

  async function salvarNomesInterlocutores() {
    setSalvandoNomes(true);
    setErro(null);
    try {
      for (const i of interlocutores) {
        const novoNome = nomesRascunho[i.id_interlocutor]?.trim();
        if (novoNome && novoNome !== (i.nome_atribuido || i.rotulo_original)) {
          const { error } = await supabase
            .from('transcricao_interlocutores')
            .update({ nome_atribuido: novoNome })
            .eq('id_interlocutor', i.id_interlocutor);
          if (error) throw error;
        }
      }
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar os nomes.');
    } finally {
      setSalvandoNomes(false);
    }
  }

  function nomeInterlocutor(id_interlocutor: string | null): string {
    if (!id_interlocutor) return 'Não identificado';
    const i = interlocutores.find((x) => x.id_interlocutor === id_interlocutor);
    return i ? i.nome_atribuido || i.rotulo_original : 'Não identificado';
  }

  const modelosVisiveis = modelos.filter((m) => {
    const segmentoModelo = m.categorias_documento?.segmento;
    // Modelos de um segmento específico (ex.: jurídico) só aparecem para
    // contas desse mesmo segmento — os demais modelos continuam visíveis
    // para todo mundo, como sempre foi.
    if (segmentoModelo === 'juridico' && conta?.segmento_uso !== 'juridico') return false;
    return true;
  });

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <p className="text-center text-slate-500 mt-10 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!transcricao) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <p className="text-center text-slate-500 mt-10 text-sm">Transcrição não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/transcricoes')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para transcrições
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">{transcricao.titulo}</h1>
        <p className="text-sm text-slate-500 mb-6">
          {transcricao.participantes_texto || 'Sem participantes informados'} · {transcricao.idioma}
        </p>

        {(transcricao.status === 'na_fila' || transcricao.status === 'processando') && (
          <Card className="mb-6">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full" />
                <div>
                  <p className="font-medium text-slate-900 text-sm">Transcrevendo...</p>
                  <p className="text-xs text-slate-500">Isso pode levar alguns minutos, dependendo da duração do áudio.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" loading={verificando} onClick={handleVerificarAgora}>
                <RefreshCw className="w-3.5 h-3.5" />
                Verificar agora
              </Button>
            </CardContent>
          </Card>
        )}

        {transcricao.status === 'erro' && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-6">
              <p className="font-medium text-red-700 text-sm">Falha na transcrição</p>
              <p className="text-sm text-red-600 mt-1">{transcricao.mensagem_erro || 'Erro desconhecido.'}</p>
            </CardContent>
          </Card>
        )}

        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-6">{erro}</div>
        )}

        {transcricao.status === 'concluido' && (
          <>
            {interlocutores.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Quem está falando
                  </CardTitle>
                  <CardDescription>Dê um nome a cada interlocutor identificado (opcional).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {interlocutores.map((i) => (
                      <div key={i.id_interlocutor} className="space-y-1">
                        <label className="text-xs text-slate-500">{i.rotulo_original}</label>
                        <Input
                          value={nomesRascunho[i.id_interlocutor] ?? ''}
                          onChange={(e) =>
                            setNomesRascunho((r) => ({ ...r, [i.id_interlocutor]: e.target.value }))
                          }
                          placeholder="Nome (opcional)"
                        />
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" loading={salvandoNomes} onClick={salvarNomesInterlocutores}>
                    <Save className="w-3.5 h-3.5" />
                    Salvar nomes
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Texto transcrito</CardTitle>
                <CardDescription>
                  {transcricao.duracao_segundos ? `${Math.round(transcricao.duracao_segundos / 60)} min` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {segmentos.length > 0 ? (
                  <div className="space-y-3">
                    {segmentos.map((s) => (
                      <div key={s.id_segmento} className="text-sm leading-relaxed">
                        <span className="text-xs font-mono text-slate-400 mr-2">[{formatarTimestamp(s.inicio_ms)}]</span>
                        <span className="font-semibold text-slate-800 mr-1">
                          {nomeInterlocutor(s.id_interlocutor)}:
                        </span>
                        <span className="text-slate-700">{s.texto}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{transcricao.texto_corrido}</p>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Cadeia de custódia
                </CardTitle>
                <CardDescription>Metadados técnicos que comprovam a origem e a integridade do arquivo original.</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-1 font-mono break-all">
                <p><span className="font-sans font-medium text-slate-500">Hash SHA-256:</span> {transcricao.hash_arquivo_sha256 || 'Não disponível'}</p>
                <p><span className="font-sans font-medium text-slate-500">Origem da captura:</span> {transcricao.origem_captura}</p>
                <p><span className="font-sans font-medium text-slate-500">Concluída em:</span> {transcricao.concluido_em ? new Date(transcricao.concluido_em).toLocaleString('pt-BR') : '—'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gerar documento a partir desta transcrição</CardTitle>
                <CardDescription>Escolha um modelo — a IA gera o rascunho automaticamente.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modelosVisiveis.map((m) => (
                    <button
                      key={m.id_modelo}
                      onClick={() => navigate(`/documentos/novo?id_transcricao=${transcricao.id_transcricao}&id_modelo=${m.id_modelo}`)}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="text-sm font-medium text-slate-800">{m.descricao}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
