import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { CompraCredito, Conta, CreditoSaldo, Plano, PapelUsuario, TipoCredito, Usuario } from '@/types/database';
import {
  Building2,
  CreditCard,
  Check,
  X,
  Ban,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Wallet,
  Users,
} from 'lucide-react';

const STATUS_CONTA_COLOR: Record<string, string> = {
  trial: 'bg-teal-100 text-teal-700',
  ativo: 'bg-blue-100 text-blue-700',
  suspenso: 'bg-amber-100 text-amber-700',
  cancelado: 'bg-red-100 text-red-700',
};

function valorSaldo(saldo: CreditoSaldo | null, tipo: TipoCredito): number {
  if (!saldo) return 0;
  switch (tipo) {
    case 'minutos':
      return saldo.minutos_disponiveis;
    case 'documentos':
      return saldo.documentos_disponiveis;
    case 'documentos_tecnicos':
      return saldo.documentos_tecnicos_disponiveis;
    case 'mensagens_ia':
      return saldo.mensagens_ia_disponiveis;
  }
}

const TIPOS_CREDITO: { valor: TipoCredito; label: string }[] = [
  { valor: 'minutos', label: 'Minutos de transcrição' },
  { valor: 'documentos', label: 'Documentos' },
  { valor: 'documentos_tecnicos', label: 'Documentos técnicos' },
  { valor: 'mensagens_ia', label: 'Mensagens IA' },
];

interface CompraComConta extends CompraCredito {
  contas?: { nome: string; email_principal: string } | null;
  pacotes_creditos?: { nome: string } | null;
}

export function AbaContas() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [compras, setCompras] = useState<CompraComConta[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const [{ data: c }, { data: p }, { data: pl }] = await Promise.all([
      supabase.from('contas').select('*').order('criado_em', { ascending: false }),
      supabase
        .from('compras_creditos')
        .select('*, contas(nome, email_principal), pacotes_creditos(nome)')
        .eq('status', 'pendente')
        .order('solicitado_em', { ascending: true }),
      supabase.from('planos').select('*').eq('ativo', true).order('ordem'),
    ]);
    setContas((c as Conta[]) || []);
    setCompras((p as CompraComConta[]) || []);
    setPlanos((pl as Plano[]) || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function aprovar(id_compra: string) {
    setProcessando(id_compra);
    setErro(null);
    const { error } = await supabase.rpc('aprovar_compra', { p_id_compra: id_compra });
    if (error) setErro(error.message);
    await carregar();
    setProcessando(null);
  }

  async function rejeitar(id_compra: string) {
    setProcessando(id_compra);
    setErro(null);
    const { error } = await supabase.rpc('rejeitar_compra', { p_id_compra: id_compra });
    if (error) setErro(error.message);
    await carregar();
    setProcessando(null);
  }

  async function alterarStatus(id_conta: string, novoStatus: string) {
    setProcessando(id_conta);
    setErro(null);
    const { error } = await supabase.rpc('alterar_status_conta', { p_id_conta: id_conta, p_novo_status: novoStatus });
    if (error) setErro(error.message);
    await carregar();
    setProcessando(null);
  }

  return (
    <div>
        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-6">{erro}</div>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Solicitações de crédito pendentes
            </CardTitle>
            <CardDescription>Compras avulsas enviadas por comprovante manual, aguardando aprovação.</CardDescription>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : compras.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="space-y-3">
                {compras.map((c) => (
                  <div key={c.id_compra} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.contas?.nome ?? '—'}</p>
                      <p className="text-xs text-slate-500">
                        {c.contas?.email_principal} · {c.pacotes_creditos?.nome ?? c.id_pacote} · {formatDate(c.solicitado_em)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={processando === c.id_compra}
                        onClick={() => rejeitar(c.id_compra)}
                      >
                        <X className="w-3.5 h-3.5" />
                        Rejeitar
                      </Button>
                      <Button size="sm" loading={processando === c.id_compra} onClick={() => aprovar(c.id_compra)}>
                        <Check className="w-3.5 h-3.5" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Todas as contas ({contas.length})
            </CardTitle>
            <CardDescription>
              Clique numa conta para gerenciar plano, créditos e status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              <div className="space-y-2">
                {contas.map((c) => {
                  const aberta = expandida === c.id_conta;
                  return (
                    <div key={c.id_conta} className="rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandida(aberta ? null : c.id_conta)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {c.email_principal} · Criada em {formatDate(c.criado_em)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CONTA_COLOR[c.status]}`}>
                            {c.status}
                          </span>
                          {aberta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {aberta && (
                        <DetalheConta
                          conta={c}
                          planos={planos}
                          onAlterarStatus={(novoStatus) => alterarStatus(c.id_conta, novoStatus)}
                          processandoStatus={processando === c.id_conta}
                          onAtualizado={carregar}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

function DetalheConta({
  conta,
  planos,
  onAlterarStatus,
  processandoStatus,
  onAtualizado,
}: {
  conta: Conta;
  planos: Plano[];
  onAlterarStatus: (novoStatus: string) => void;
  processandoStatus: boolean;
  onAtualizado: () => void;
}) {
  const [saldo, setSaldo] = useState<CreditoSaldo | null>(null);
  const [carregandoSaldo, setCarregandoSaldo] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [salvandoUsuario, setSalvandoUsuario] = useState<string | null>(null);
  const [idPlanoSelecionado, setIdPlanoSelecionado] = useState(conta.id_plano ?? '');
  const [tipoAjuste, setTipoAjuste] = useState<TipoCredito>('minutos');
  const [quantidadeAjuste, setQuantidadeAjuste] = useState('');
  const [salvandoPlano, setSalvandoPlano] = useState(false);
  const [salvandoCredito, setSalvandoCredito] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('credito_saldo')
      .select('*')
      .eq('id_conta', conta.id_conta)
      .maybeSingle()
      .then(({ data }) => {
        setSaldo(data as CreditoSaldo | null);
        setCarregandoSaldo(false);
      });

    carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta.id_conta]);

  async function carregarUsuarios() {
    setCarregandoUsuarios(true);
    const { data } = await supabase.from('usuarios').select('*').eq('id_conta', conta.id_conta).order('criado_em');
    setUsuarios((data as Usuario[]) || []);
    setCarregandoUsuarios(false);
  }

  async function alternarAtivoUsuario(u: Usuario) {
    setSalvandoUsuario(u.id_usuario);
    setErroLocal(null);
    const { error } = await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('id_usuario', u.id_usuario);
    if (error) setErroLocal(error.message);
    await carregarUsuarios();
    setSalvandoUsuario(null);
  }

  async function alterarPapelUsuario(u: Usuario, novoPapel: PapelUsuario) {
    setSalvandoUsuario(u.id_usuario);
    setErroLocal(null);
    const { error } = await supabase.from('usuarios').update({ papel: novoPapel }).eq('id_usuario', u.id_usuario);
    if (error) setErroLocal(error.message);
    await carregarUsuarios();
    setSalvandoUsuario(null);
  }

  async function salvarPlano() {
    if (!idPlanoSelecionado) return;
    setSalvandoPlano(true);
    setErroLocal(null);
    setSucesso(null);
    const { error } = await supabase.rpc('gestor_alterar_plano', {
      p_id_conta: conta.id_conta,
      p_id_plano: idPlanoSelecionado,
    });
    if (error) setErroLocal(error.message);
    else {
      setSucesso('Plano atualizado.');
      onAtualizado();
    }
    setSalvandoPlano(false);
  }

  async function aplicarAjuste(sinal: 1 | -1) {
    const qtd = Number(quantidadeAjuste);
    if (!qtd || qtd <= 0) {
      setErroLocal('Informe uma quantidade maior que zero.');
      return;
    }
    setSalvandoCredito(true);
    setErroLocal(null);
    setSucesso(null);
    const { error } = await supabase.rpc('gestor_ajustar_credito', {
      p_id_conta: conta.id_conta,
      p_tipo: tipoAjuste,
      p_quantidade: qtd * sinal,
      p_motivo: 'ajuste_manual',
    });
    if (error) {
      setErroLocal(error.message);
    } else {
      setSucesso(`Crédito ${sinal > 0 ? 'liberado' : 'descontado'} com sucesso.`);
      setQuantidadeAjuste('');
      const { data } = await supabase.from('credito_saldo').select('*').eq('id_conta', conta.id_conta).maybeSingle();
      setSaldo(data as CreditoSaldo | null);
    }
    setSalvandoCredito(false);
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-5">
      {erroLocal && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{erroLocal}</div>
      )}
      {sucesso && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-700">{sucesso}</div>
      )}

      {/* Saldo atual */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" />
          Saldo atual
        </p>
        {carregandoSaldo ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIPOS_CREDITO.map((t) => (
              <div key={t.valor} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-lg font-bold text-slate-900">{valorSaldo(saldo, t.valor)}</p>
                <p className="text-[11px] text-slate-500">{t.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liberar/descontar crédito manualmente */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Liberar ou descontar crédito</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`tipo-${conta.id_conta}`} className="text-xs">Tipo</Label>
            <select
              id={`tipo-${conta.id_conta}`}
              value={tipoAjuste}
              onChange={(e) => setTipoAjuste(e.target.value as TipoCredito)}
              className="flex h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"
            >
              {TIPOS_CREDITO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`qtd-${conta.id_conta}`} className="text-xs">Quantidade</Label>
            <Input
              id={`qtd-${conta.id_conta}`}
              type="number"
              min={1}
              value={quantidadeAjuste}
              onChange={(e) => setQuantidadeAjuste(e.target.value)}
              className="h-9 w-28 text-xs"
              placeholder="Ex.: 100"
            />
          </div>
          <Button size="sm" loading={salvandoCredito} onClick={() => aplicarAjuste(1)}>
            Liberar
          </Button>
          <Button size="sm" variant="outline" loading={salvandoCredito} onClick={() => aplicarAjuste(-1)}>
            Descontar
          </Button>
        </div>
      </div>

      {/* Plano */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plano de pagamento</p>
        <div className="flex items-end gap-2">
          <select
            value={idPlanoSelecionado}
            onChange={(e) => setIdPlanoSelecionado(e.target.value)}
            className="flex h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"
          >
            {planos.map((p) => (
              <option key={p.id_plano} value={p.id_plano}>
                {p.nome} — R$ {p.preco_mensal}/mês
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" loading={salvandoPlano} onClick={salvarPlano}>
            Salvar plano
          </Button>
        </div>
      </div>

      {/* Usuários da conta */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Usuários desta conta ({usuarios.length})
        </p>
        {carregandoUsuarios ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {usuarios.map((u) => (
              <div key={u.id_usuario} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{u.nome}</p>
                  <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={u.papel}
                    onChange={(e) => alterarPapelUsuario(u, e.target.value as PapelUsuario)}
                    disabled={salvandoUsuario === u.id_usuario}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                  >
                    <option value="owner">Owner</option>
                    <option value="membro">Membro</option>
                    <option value="gestor_plataforma">Gestor da plataforma</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={salvandoUsuario === u.id_usuario}
                    onClick={() => alternarAtivoUsuario(u)}
                  >
                    {u.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status da conta */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status da conta</p>
        {conta.status !== 'suspenso' ? (
          <Button size="sm" variant="outline" loading={processandoStatus} onClick={() => onAlterarStatus('suspenso')}>
            <Ban className="w-3.5 h-3.5" />
            Suspender conta
          </Button>
        ) : (
          <Button size="sm" variant="outline" loading={processandoStatus} onClick={() => onAlterarStatus('ativo')}>
            <PlayCircle className="w-3.5 h-3.5" />
            Reativar conta
          </Button>
        )}
      </div>
    </div>
  );
}
