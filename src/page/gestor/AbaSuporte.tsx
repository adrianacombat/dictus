import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { StatusTicketSuporte, SuporteMensagem, SuporteTicket, TipoTicketSuporte } from '@/types/database';
import { LifeBuoy, ArrowLeft, Send, Bug, Lightbulb, HelpCircle, Plus } from 'lucide-react';

interface TicketComConta extends SuporteTicket {
  contas?: { nome: string; email_principal: string } | null;
}

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

const TIPO_ICONE: Record<TipoTicketSuporte, typeof Bug> = {
  bug: Bug,
  sugestao: Lightbulb,
  duvida: HelpCircle,
};

const FILTROS: { valor: StatusTicketSuporte | 'todos'; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'aberto', label: 'Abertos' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'resolvido', label: 'Resolvidos' },
];

export function AbaSuporte() {
  const [tickets, setTickets] = useState<TicketComConta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<StatusTicketSuporte | 'todos'>('todos');
  const [ticketAberto, setTicketAberto] = useState<TicketComConta | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [tituloNovo, setTituloNovo] = useState('');
  const [tipoNovo, setTipoNovo] = useState<TipoTicketSuporte>('duvida');
  const [criando, setCriando] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('suporte_tickets')
      .select('*, contas(nome, email_principal)')
      .order('atualizado_em', { ascending: false });
    setTickets((data as TicketComConta[]) || []);
    setCarregando(false);
  }

  function abrirCriarInterno() {
    setTituloNovo('');
    setTipoNovo('duvida');
    setErroNovo(null);
    setModalAberto(true);
  }

  async function criarTicketInterno() {
    if (!tituloNovo.trim()) {
      setErroNovo('Informe um título.');
      return;
    }
    setCriando(true);
    setErroNovo(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setErroNovo('Não foi possível identificar seu usuário.');
      setCriando(false);
      return;
    }

    const { data: usuario } = await supabase.from('usuarios').select('id_conta').eq('id_usuario', user.id).maybeSingle();
    if (!usuario) {
      setErroNovo('Não foi possível identificar sua conta.');
      setCriando(false);
      return;
    }

    const { error } = await supabase.from('suporte_tickets').insert({
      id_conta: usuario.id_conta,
      id_usuario_criador: user.id,
      titulo: `[Interno] ${tituloNovo.trim()}`,
      tipo: tipoNovo,
    });

    if (error) {
      setErroNovo(error.message);
    } else {
      setModalAberto(false);
      await carregar();
    }
    setCriando(false);
  }

  const filtrados = filtro === 'todos' ? tickets : tickets.filter((t) => t.status === filtro);

  if (ticketAberto) {
    return (
      <ThreadTicketGestor
        ticket={ticketAberto}
        onVoltar={async () => {
          setTicketAberto(null);
          await carregar();
        }}
      />
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4" />
            Tickets de suporte
          </CardTitle>
          <CardDescription>Bugs, sugestões e dúvidas relatadas pelos clientes de todas as contas.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={abrirCriarInterno}>
          <Plus className="w-3.5 h-3.5" />
          Novo ticket interno
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filtro === f.valor ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum ticket encontrado.</p>
        ) : (
          <div className="space-y-2">
            {filtrados.map((t) => {
              const Icone = TIPO_ICONE[t.tipo];
              return (
                <button
                  key={t.id_ticket}
                  type="button"
                  onClick={() => setTicketAberto(t)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.titulo}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {t.contas?.nome ?? '—'} · {formatDate(t.criado_em)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo ticket interno" descricao="Registra um ticket associado à sua própria conta de gestor.">
      <div className="space-y-3">
        {erroNovo && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erroNovo}</div>}
        <div className="space-y-1">
          <Label className="text-xs">Título</Label>
          <Input value={tituloNovo} onChange={(e) => setTituloNovo(e.target.value)} placeholder="Ex.: Verificar cobrança duplicada" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <select
            value={tipoNovo}
            onChange={(e) => setTipoNovo(e.target.value as TipoTicketSuporte)}
            className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="duvida">Dúvida</option>
            <option value="bug">Bug</option>
            <option value="sugestao">Sugestão</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
          <Button size="sm" loading={criando} onClick={criarTicketInterno}>Criar ticket</Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

function ThreadTicketGestor({ ticket, onVoltar }: { ticket: TicketComConta; onVoltar: () => void }) {
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState<StatusTicketSuporte>(ticket.status);
  const [salvandoStatus, setSalvandoStatus] = useState(false);

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
    if (!resposta.trim()) return;
    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('suporte_mensagens').insert({ id_ticket: ticket.id_ticket, id_usuario: user.id, conteudo: resposta.trim() });
      await supabase.from('suporte_tickets').update({ atualizado_em: new Date().toISOString() }).eq('id_ticket', ticket.id_ticket);
    }
    setResposta('');
    await carregar();
    setEnviando(false);
  }

  async function alterarStatus(novo: StatusTicketSuporte) {
    setSalvandoStatus(true);
    setStatus(novo);
    await supabase.from('suporte_tickets').update({ status: novo, atualizado_em: new Date().toISOString() }).eq('id_ticket', ticket.id_ticket);
    setSalvandoStatus(false);
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" />
        Voltar para tickets
      </button>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{ticket.titulo}</h3>
          <p className="text-xs text-slate-500">
            {ticket.contas?.nome} — {ticket.contas?.email_principal}
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => alterarStatus(e.target.value as StatusTicketSuporte)}
          disabled={salvandoStatus}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"
        >
          <option value="aberto">Aberto</option>
          <option value="em_andamento">Em andamento</option>
          <option value="resolvido">Resolvido</option>
        </select>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            mensagens.map((m) => (
              <div key={m.id_mensagem} className="rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-800">
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
          placeholder="Responder ao cliente..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        />
        <Button type="submit" loading={enviando}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
