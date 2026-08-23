import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sha256File, fileToBase64 } from '@/lib/hash';
import { iniciarTranscricao } from '@/lib/iaGateway';
import { AppHeader } from '@/components/AppHeader';
import { CapturaAudioVideo } from '@/components/CapturaAudioVideo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type { OrigemCaptura, Transcricao } from '@/types/database';
import { cn } from '@/lib/utils';
import { Mic, Plus, Upload, FileAudio, X, Video, MonitorUp } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  na_fila: 'Na fila',
  processando: 'Processando',
  concluido: 'Concluído',
  erro: 'Erro',
  reprocessando: 'Reprocessando',
};

const STATUS_COLOR: Record<string, string> = {
  na_fila: 'bg-slate-100 text-slate-600',
  processando: 'bg-amber-100 text-amber-700',
  concluido: 'bg-teal-100 text-teal-700',
  erro: 'bg-red-100 text-red-700',
  reprocessando: 'bg-amber-100 text-amber-700',
};

export function TranscricoesPage() {
  const { conta } = useAuth();
  const navigate = useNavigate();
  const [transcricoes, setTranscricoes] = useState<Transcricao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function carregar() {
    setLoadingList(true);
    const { data } = await supabase
      .from('transcricoes')
      .select('*')
      .order('criado_em', { ascending: false });
    setTranscricoes((data as Transcricao[]) || []);
    setLoadingList(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transcrições</h1>
            <p className="text-slate-500 mt-1 text-sm">Áudio e vídeo convertidos em texto por IA.</p>
          </div>
          <Button onClick={() => setMostrarForm((v) => !v)}>
            <Plus className="w-4 h-4" />
            Nova transcrição
          </Button>
        </div>

        {mostrarForm && (
          <NovaTranscricaoForm
            onCriada={(id) => {
              setMostrarForm(false);
              navigate(`/transcricoes/${id}`);
            }}
            onCancelar={() => setMostrarForm(false)}
          />
        )}

        {loadingList ? (
          <p className="text-slate-500 text-sm">Carregando...</p>
        ) : transcricoes.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <FileAudio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma transcrição ainda. Clique em "Nova transcrição" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {transcricoes.map((t) => (
              <Link key={t.id_transcricao} to={`/transcricoes/${t.id_transcricao}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                        <Mic className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{t.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t.criado_em))}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {conta && (
          <p className="text-xs text-slate-400 mt-6">
            Conta: {conta.nome} · Os arquivos de áudio/vídeo nunca são armazenados — apenas o hash e o texto transcrito.
          </p>
        )}
      </main>
    </div>
  );
}

const MODOS_CAPTURA: { valor: OrigemCaptura; label: string; icone: typeof Upload }[] = [
  { valor: 'upload', label: 'Enviar arquivo', icone: Upload },
  { valor: 'presencial', label: 'Presencial (áudio)', icone: Mic },
  { valor: 'presencial_video', label: 'Presencial (vídeo)', icone: Video },
  { valor: 'navegador_aba', label: 'Captura de aba (Meet/Zoom)', icone: MonitorUp },
];

function NovaTranscricaoForm({ onCriada, onCancelar }: { onCriada: (id: string) => void; onCancelar: () => void }) {
  const { usuario, conta } = useAuth();
  const [modo, setModo] = useState<OrigemCaptura>('upload');
  const [titulo, setTitulo] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');
  const [qtdInterlocutores, setQtdInterlocutores] = useState('');
  const [arquivo, setArquivo] = useState<File | Blob | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [aceitouConsentimento, setAceitouConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const TEXTO_CONSENTIMENTO =
    'Declaro que tenho autorização para gravar/transcrever este áudio ou vídeo e que todos os ' +
    'participantes envolvidos, quando aplicável, estão cientes desta captura e do uso de ' +
    'inteligência artificial para transcrição automática.';

  function trocarModo(novoModo: OrigemCaptura) {
    setModo(novoModo);
    setArquivo(null);
    setNomeArquivo('');
    setErro(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!arquivo || !titulo || !aceitouConsentimento || !usuario || !conta) {
      setErro('Preencha o título, selecione/grave um áudio ou vídeo e aceite o termo de consentimento.');
      return;
    }

    setEnviando(true);
    try {
      const hash = await sha256File(arquivo);
      const base64 = await fileToBase64(arquivo);

      const { data: consentimento, error: consErr } = await supabase
        .from('consentimentos')
        .insert({
          id_conta: conta.id_conta,
          id_usuario: usuario.id_usuario,
          tipo: 'gravacao',
          texto_versao: TEXTO_CONSENTIMENTO,
        })
        .select('id_consentimento')
        .single();
      if (consErr || !consentimento) throw new Error('Falha ao registrar o consentimento.');

      const { data: transcricao, error: transErr } = await supabase
        .from('transcricoes')
        .insert({
          id_conta: conta.id_conta,
          id_usuario: usuario.id_usuario,
          id_consentimento: consentimento.id_consentimento,
          titulo,
          participantes_texto: participantes || null,
          origem_captura: modo,
          qtd_interlocutores_informada: qtdInterlocutores ? Number(qtdInterlocutores) : null,
          idioma,
          hash_arquivo_sha256: hash,
          nome_arquivo_original: nomeArquivo,
          status: 'na_fila',
        })
        .select('id_transcricao')
        .single();
      if (transErr || !transcricao) throw new Error('Falha ao criar a transcrição.');

      await iniciarTranscricao({
        id_transcricao: transcricao.id_transcricao,
        arquivo_base64: base64,
        nome_arquivo: nomeArquivo,
        idioma,
        qtd_interlocutores: qtdInterlocutores ? Number(qtdInterlocutores) : null,
      });

      onCriada(transcricao.id_transcricao);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado ao iniciar a transcrição.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Nova transcrição</CardTitle>
          <CardDescription>Envie um arquivo de áudio ou vídeo para transcrever.</CardDescription>
        </div>
        <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo" required>Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com cliente — 22/08" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participantes">Participantes (texto livre)</Label>
            <Input id="participantes" value={participantes} onChange={(e) => setParticipantes(e.target.value)} placeholder="Ex.: João Silva, Maria Souza" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="idioma">Idioma</Label>
              <select
                id="idioma"
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="pt-BR">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Nº de falantes (opcional)</Label>
              <Input id="qtd" type="number" min={1} max={10} value={qtdInterlocutores} onChange={(e) => setQtdInterlocutores(e.target.value)} placeholder="Ex.: 2" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label required>Como capturar o áudio/vídeo</Label>
            <div className="grid grid-cols-2 gap-2">
              {MODOS_CAPTURA.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => trocarModo(m.valor)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                    modo === m.valor
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <m.icone className="w-3.5 h-3.5 shrink-0" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {modo === 'upload' ? (
            <label className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-500">
                {arquivo ? nomeArquivo : 'Clique para selecionar (mp3, wav, mp4, m4a...)'}
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArquivo(f);
                  setNomeArquivo(f?.name ?? '');
                }}
              />
            </label>
          ) : (
            <CapturaAudioVideo
              modo={modo as 'presencial' | 'presencial_video' | 'navegador_aba' | 'navegador_aba_video'}
              gravacaoPronta={!!arquivo}
              onGravado={(blob, nome) => {
                setArquivo(blob);
                setNomeArquivo(nome);
              }}
              onLimpar={() => {
                setArquivo(null);
                setNomeArquivo('');
              }}
            />
          )}

          <label className="flex items-start gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={aceitouConsentimento}
              onChange={(e) => setAceitouConsentimento(e.target.checked)}
              className="mt-0.5"
            />
            {TEXTO_CONSENTIMENTO}
          </label>

          {erro && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>
          )}

          <Button type="submit" loading={enviando} className="w-full">
            Iniciar transcrição
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
