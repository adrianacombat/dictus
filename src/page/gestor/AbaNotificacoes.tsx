import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { Conta, EscopoNotificacao, Notificacao, Usuario } from '@/types/database';
import { Send, Image as ImageIcon, Megaphone, Plus, CheckCheck } from 'lucide-react';

const ESCOPOS: { valor: EscopoNotificacao; label: string }[] = [
  { valor: 'todos', label: 'Todos os usuários da plataforma' },
  { valor: 'conta', label: 'Uma conta específica (todos os membros dela)' },
  { valor: 'usuario', label: 'Um usuário específico' },
];

interface NotificacaoComLeitura extends Notificacao {
  totalDestinatarios: number;
  totalLidas: number;
}

export function AbaNotificacoes() {
  const [modalAberto, setModalAberto] = useState(false);
  const [escopo, setEscopo] = useState<EscopoNotificacao>('todos');
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [contas, setContas] = useState<Conta[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [idContaSelecionada, setIdContaSelecionada] = useState('');
  const [idUsuarioSelecionado, setIdUsuarioSelecionado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<NotificacaoComLeitura[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  useEffect(() => {
    supabase
      .from('contas')
      .select('*')
      .order('nome')
      .then(({ data }) => setContas((data as Conta[]) || []));
    supabase
      .from('usuarios')
      .select('*')
      .order('nome')
      .then(({ data }) => setUsuarios((data as Usuario[]) || []));
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const { data: notifs } = await supabase
      .from('notificacoes')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(20);
    const lista = (notifs as Notificacao[]) || [];

    const { count: totalUsuarios } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });

    const ids = lista.map((n) => n.id_notificacao);
    const { data: leituras } = ids.length
      ? await supabase.from('notificacoes_leituras').select('id_notificacao').in('id_notificacao', ids)
      : { data: [] as { id_notificacao: string }[] };

    const contagemLidas = new Map<string, number>();
    for (const l of leituras || []) {
      contagemLidas.set(l.id_notificacao, (contagemLidas.get(l.id_notificacao) || 0) + 1);
    }

    const comLeitura: NotificacaoComLeitura[] = lista.map((n) => ({
      ...n,
      totalDestinatarios: n.escopo === 'todos' ? totalUsuarios || 0 : n.escopo === 'usuario' ? 1 : usuarios.filter((u) => u.id_conta === n.id_conta).length,
      totalLidas: contagemLidas.get(n.id_notificacao) || 0,
    }));

    setEnviadas(comLeitura);
    setCarregandoHistorico(false);
  }

  function inserirImagem() {
    if (!imagemUrl.trim()) return;
    setCorpo((prev) => `${prev}\n<img src="${imagemUrl.trim()}" alt="" />`);
    setImagemUrl('');
  }

  function abrirCriar() {
    setEscopo('todos');
    setTitulo('');
    setCorpo('');
    setImagemUrl('');
    setIdContaSelecionada('');
    setIdUsuarioSelecionado('');
    setErro(null);
    setModalAberto(true);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!titulo.trim() || !corpo.trim()) {
      setErro('Preencha título e mensagem.');
      return;
    }
    if (escopo === 'conta' && !idContaSelecionada) {
      setErro('Selecione a conta de destino.');
      return;
    }
    if (escopo === 'usuario' && !idUsuarioSelecionado) {
      setErro('Selecione o usuário de destino.');
      return;
    }

    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('notificacoes').insert({
      escopo,
      id_conta: escopo === 'conta' ? idContaSelecionada : null,
      id_usuario_destino: escopo === 'usuario' ? idUsuarioSelecionado : null,
      titulo: titulo.trim(),
      corpo_html: corpo.trim().replace(/\n/g, '<br />'),
      criado_por: user?.id ?? null,
    });

    if (error) {
      setErro(error.message);
    } else {
      setModalAberto(false);
      await carregarHistorico();
    }
    setEnviando(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Últimas notificações enviadas
            </CardTitle>
            <CardDescription>Quantas pessoas já leram cada uma, em relação ao total de destinatários.</CardDescription>
          </div>
          <Button size="sm" onClick={abrirCriar}>
            <Plus className="w-3.5 h-3.5" />
            Criar notificação
          </Button>
        </CardHeader>
        <CardContent>
          {carregandoHistorico ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : enviadas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma notificação enviada ainda.</p>
          ) : (
            <div className="space-y-2">
              {enviadas.map((n) => (
                <div key={n.id_notificacao} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(n.criado_em)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <p className="text-xs text-slate-500">
                      Destino: {n.escopo === 'todos' ? 'Todos' : n.escopo === 'conta' ? 'Conta específica' : 'Usuário específico'} ·
                      {' '}Recebida por {n.totalDestinatarios} pessoa{n.totalDestinatarios === 1 ? '' : 's'}
                    </p>
                    <span className="flex items-center gap-1 text-xs text-teal-700 shrink-0">
                      <CheckCheck className="w-3.5 h-3.5" />
                      {n.totalLidas}/{n.totalDestinatarios} lida{n.totalLidas === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Enviar notificação" descricao="Para todos, para uma conta ou para um usuário específico. Pode incluir imagens colando a URL.">
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Destinatário</Label>
            <select
              value={escopo}
              onChange={(e) => setEscopo(e.target.value as EscopoNotificacao)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {ESCOPOS.map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          {escopo === 'conta' && (
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <select
                value={idContaSelecionada}
                onChange={(e) => setIdContaSelecionada(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {contas.map((c) => (
                  <option key={c.id_conta} value={c.id_conta}>
                    {c.nome} — {c.email_principal}
                  </option>
                ))}
              </select>
            </div>
          )}

          {escopo === 'usuario' && (
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <select
                value={idUsuarioSelecionado}
                onChange={(e) => setIdUsuarioSelecionado(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {usuarios.map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>
                    {u.nome} — {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Manutenção programada" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="corpo">Mensagem</Label>
            <textarea
              id="corpo"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={5}
              placeholder="Escreva a mensagem. Você pode colar uma URL de imagem abaixo para incluí-la."
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="imagemUrl">URL de imagem (opcional)</Label>
              <Input id="imagemUrl" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button type="button" variant="outline" onClick={inserirImagem}>
              <ImageIcon className="w-4 h-4" />
              Inserir
            </Button>
          </div>

          {corpo && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pré-visualização</p>
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 [&_img]:rounded-lg [&_img]:mt-2 [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: corpo.replace(/\n/g, '<br />') }}
              />
            </div>
          )}

          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button type="submit" size="sm" loading={enviando}>
              <Send className="w-3.5 h-3.5" />
              Enviar notificação
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
