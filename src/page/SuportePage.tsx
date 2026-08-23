import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { SuporteMensagem, SuporteTicket, TipoTicketSuporte } from '@/types/database';
import { LifeBuoy, Plus, Send, ArrowLeft, Bug, Lightbulb, HelpCircle } from 'lucide-react';

const TIPOS: { valor: TipoTicketSuporte; label: string; icone: typeof Bug }[] = [
  { valor: 'bug', label: 'Reportar um erro', icone: Bug },
  { valor: 'sugestao', label: 'Enviar uma sugestão', icone: Lightbulb },
  { valor: 'duvida', label: 'Tirar uma dúvida', icone: HelpCircle },
];

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};

const STATUS_COLOR: Record<string, string> = {
  aberto: 'bg-amber-100 text-amber-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  resolvido: 'bg-teal-100 text-teal-700',
};

export function SuportePage() {
  const { user, conta } = useAuth();
  const [tickets, setTickets] = useState<SuporteTicket[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ticketAberto, setTicketAberto] = useState<SuporteTicket | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoTicketSuporte>('duvida');
  const [novaMensagem, setNovaMensagem] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarTickets();
  }, []);

  async function carregarTickets() {
    setCarregando(true);
    const { data } = await supabase.from('suporte_tickets').select('*').order('atualizado_em', { ascending: false });
    setTickets((data as SuporteTicket[]) || []);
    setCarregando(false);
  }

  async function criarTicket(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!novoTitulo.trim() || !novaMensagem.trim() || !conta || !user) {
      setErro('Preencha o título e a mensagem.');
      return;
    }
    setCriando(true);
    const { data: ticket, error } = await supabase
      .from('suporte_tickets')
      .insert({ id_conta: conta.id_conta, id_usuario_criador: user.id, titulo: novoTitulo.trim(), tipo: novoTipo })
      .select()
      .single();

    if (error || !ticket) {
      setErro(error?.message ?? 'Erro ao criar ticket.');
      setCriando(false);
      return;
    }

    await supabase.from('suporte_mensagens').insert({
      id_ticket: (ticket as SuporteTicket).id_ticket,
      id_usuario: user.id,
      conteudo: novaMensagem.trim(),
    });

    setNovoTitulo('');
    setNovaMensagem('');
    setNovoTipo('duvida');
    setMostrarNovo(false);
    setCriando(false);
    await carregarTickets();
  }

  if (ticketAberto) {
    return (
      <ThreadTicket
        ticket={ticketAberto}
        onVoltar={() => {
          setTicketAberto(null);
          carregarTickets();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-teal-600" />
              Suporte
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Relate erros, envie sugestões ou tire dúvidas com a equipe.</p>
          </div>
          <Button onClick={() => setMostrarNovo((v) => !v)}>
            <Plus className="w-4 h-4" />
            Novo ticket
          </Button>
        </div>

        {mostrarNovo && (
          <Card>
            <CardHeader>
              <CardTitle>Abrir novo ticket</CardTitle>
              <CardDescription>Conte o que aconteceu — a equipe da Falari vai responder por aqui mesmo.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={criarTicket} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t.valor}
                        type="button"
                        onClick={() => setNovoTipo(t.valor)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors ${
                          novoTipo === t.valor
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <t.icone className="w-4 h-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="novoTitulo">Título</Label>
                  <Input id="novoTitulo" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Resuma em poucas palavras" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="novaMensagem">Mensagem</Label>
                  <textarea
                    id="novaMensagem"
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    rows={4}
                    placeholder="Descreva com detalhes..."
                    className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  />
                </div>
                {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}
                <Button type="submit" loading={criando}>
                  <Send className="w-4 h-4" />
                  Enviar ticket
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Meus tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">Você ainda não abriu nenhum ticket.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id_ticket}
                    type="button"
                    onClick={() => setTicketAberto(t)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.titulo}</p>
                      <p className="text-xs text-slate-500">{formatDate(t.criado_em)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ThreadTicket({ ticket, onVoltar }: { ticket: SuporteTicket; onVoltar: () => void }) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id_ticket]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('suporte_mensagens')
      .select('*')
      .eq('id_ticket', ticket.id_ticket)
      .order('criado_em', { ascending: true });
    setMensagens((data as SuporteMensagem[]) || []);
    setCarregando(false);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!resposta.trim() || !user) return;
    setEnviando(true);
    await supabase.from('suporte_mensagens').insert({ id_ticket: ticket.id_ticket, id_usuario: user.id, conteudo: resposta.trim() });
    setResposta('');
    await carregar();
    setEnviando(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <button type="button" onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          Voltar para meus tickets
        </button>

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">{ticket.titulo}</h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3">
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              mensagens.map((m) => (
                <div
                  key={m.id_mensagem}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.id_usuario === user?.id ? 'bg-teal-50 text-teal-900 ml-8' : 'bg-slate-100 text-slate-800 mr-8'
                  }`}
                >
                  <p>{m.conteudo}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{formatDate(m.criado_em)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <form onSubmit={enviar} className="flex items-end gap-2">
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={2}
            placeholder="Escreva uma resposta..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          />
          <Button type="submit" loading={enviando}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
