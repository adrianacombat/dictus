import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { PacoteCredito, TipoCredito } from '@/types/database';
import { Plus, Pencil, Power } from 'lucide-react';

const TIPOS: { valor: TipoCredito; label: string }[] = [
  { valor: 'minutos', label: 'Minutos de transcrição' },
  { valor: 'documentos', label: 'Documentos' },
  { valor: 'documentos_tecnicos', label: 'Documentos técnicos' },
  { valor: 'mensagens_ia', label: 'Mensagens IA' },
];

const TIPO_LABEL: Record<TipoCredito, string> = Object.fromEntries(TIPOS.map((t) => [t.valor, t.label])) as Record<TipoCredito, string>;

type FormPacote = Omit<PacoteCredito, 'id_pacote'>;

const PACOTE_VAZIO: FormPacote = {
  nome: '',
  tipo: 'minutos',
  quantidade: 0,
  preco_brl: 0,
  ativo: true,
  ordem: 0,
};

export function AbaPacotes() {
  const [pacotes, setPacotes] = useState<PacoteCredito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormPacote>(PACOTE_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('pacotes_creditos').select('*').order('ordem');
    setPacotes((data as PacoteCredito[]) || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriar() {
    setEditandoId(null);
    setForm(PACOTE_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(pacote: PacoteCredito) {
    setEditandoId(pacote.id_pacote);
    const { id_pacote: _id_pacote, ...resto } = pacote;
    void _id_pacote;
    setForm(resto);
    setErro(null);
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim() || form.quantidade <= 0 || form.preco_brl <= 0) {
      setErro('Preencha nome, quantidade e preço (maiores que zero).');
      return;
    }
    setSalvando(true);
    setErro(null);

    const { error } = editandoId
      ? await supabase.from('pacotes_creditos').update(form).eq('id_pacote', editandoId)
      : await supabase.from('pacotes_creditos').insert(form);

    if (error) {
      setErro(error.message);
    } else {
      setModalAberto(false);
      await carregar();
    }
    setSalvando(false);
  }

  async function alternarAtivo(pacote: PacoteCredito) {
    setAlternandoId(pacote.id_pacote);
    const { error } = await supabase.from('pacotes_creditos').update({ ativo: !pacote.ativo }).eq('id_pacote', pacote.id_pacote);
    if (error) setErro(error.message);
    await carregar();
    setAlternandoId(null);
  }

  return (
    <div className="space-y-6">
      {erro && !modalAberto && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Pacotes existentes ({pacotes.length})</CardTitle>
            <CardDescription>Pacotes de crédito avulso que aparecem para o cliente comprar.</CardDescription>
          </div>
          <Button size="sm" onClick={abrirCriar}>
            <Plus className="w-3.5 h-3.5" />
            Criar pacote
          </Button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : pacotes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum pacote cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {pacotes.map((pacote) => (
                <div
                  key={pacote.id_pacote}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${pacote.ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{pacote.nome}</p>
                    <p className="text-xs text-slate-500">
                      {pacote.quantidade} {TIPO_LABEL[pacote.tipo]} · {formatCurrency(pacote.preco_brl)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(pacote)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Alterar
                    </Button>
                    <Button
                      size="sm"
                      variant={pacote.ativo ? 'outline' : 'primary'}
                      loading={alternandoId === pacote.id_pacote}
                      onClick={() => alternarAtivo(pacote)}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {pacote.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        titulo={editandoId ? 'Alterar pacote' : 'Criar novo pacote avulso'}
        descricao="Pacotes que aparecem para o cliente comprar créditos extras."
      >
        <div className="space-y-3">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: 120 minutos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoCredito }))}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço (R$)</Label>
              <Input type="number" value={form.preco_brl} onChange={(e) => setForm((f) => ({ ...f, preco_brl: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ordem de exibição</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button size="sm" loading={salvando} onClick={salvar}>
              {editandoId ? 'Salvar alterações' : 'Criar pacote'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
