import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type { PrecoProvedorIA, UnidadePrecoIA } from '@/types/database';
import { Plus, Pencil, Power, DollarSign } from 'lucide-react';

const UNIDADES: { valor: UnidadePrecoIA; label: string }[] = [
  { valor: 'por_minuto', label: 'Por minuto de áudio' },
  { valor: 'por_1k_tokens_entrada', label: 'Por 1.000 tokens de entrada' },
  { valor: 'por_1k_tokens_saida', label: 'Por 1.000 tokens de saída' },
  { valor: 'por_documento', label: 'Por documento gerado' },
];

const UNIDADE_LABEL: Record<UnidadePrecoIA, string> = Object.fromEntries(UNIDADES.map((u) => [u.valor, u.label])) as Record<UnidadePrecoIA, string>;

type FormPreco = Omit<PrecoProvedorIA, 'id_preco'>;

const PRECO_VAZIO: FormPreco = {
  provedor: '',
  modelo: '',
  unidade: 'por_minuto',
  preco_usd: 0,
  ativo: true,
};

export function AbaPrecosIA() {
  const [precos, setPrecos] = useState<PrecoProvedorIA[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormPreco>(PRECO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('precos_provedores_ia').select('*').order('provedor');
    setPrecos((data as PrecoProvedorIA[]) || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriar() {
    setEditandoId(null);
    setForm(PRECO_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(preco: PrecoProvedorIA) {
    setEditandoId(preco.id_preco);
    const { id_preco: _id, ...resto } = preco;
    void _id;
    setForm(resto);
    setErro(null);
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.provedor.trim() || !form.modelo.trim()) {
      setErro('Informe o provedor e o modelo.');
      return;
    }
    setSalvando(true);
    setErro(null);

    const { error } = editandoId
      ? await supabase.from('precos_provedores_ia').update(form).eq('id_preco', editandoId)
      : await supabase.from('precos_provedores_ia').insert(form);

    if (error) {
      setErro(error.message);
    } else {
      setModalAberto(false);
      await carregar();
    }
    setSalvando(false);
  }

  async function alternarAtivo(preco: PrecoProvedorIA) {
    setAlternandoId(preco.id_preco);
    const { error } = await supabase.from('precos_provedores_ia').update({ ativo: !preco.ativo }).eq('id_preco', preco.id_preco);
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
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Preços dos provedores de IA ({precos.length})
            </CardTitle>
            <CardDescription>
              Usado só para estimar o custo por cliente e geral no painel de Consumo. Não afeta o
              que o cliente paga — mantenha atualizado com o preço real do console de cada provedor.
            </CardDescription>
          </div>
          <Button size="sm" onClick={abrirCriar}>
            <Plus className="w-3.5 h-3.5" />
            Cadastrar preço
          </Button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : precos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum preço cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {precos.map((preco) => (
                <div
                  key={preco.id_preco}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${preco.ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{preco.provedor} — {preco.modelo}</p>
                    <p className="text-xs text-slate-500">
                      US$ {Number(preco.preco_usd).toFixed(6)} {UNIDADE_LABEL[preco.unidade]}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(preco)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Alterar
                    </Button>
                    <Button
                      size="sm"
                      variant={preco.ativo ? 'outline' : 'primary'}
                      loading={alternandoId === preco.id_preco}
                      onClick={() => alternarAtivo(preco)}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {preco.ativo ? 'Desativar' : 'Ativar'}
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
        titulo={editandoId ? 'Alterar preço' : 'Cadastrar preço de IA'}
        descricao="Provedor, modelo e quanto ele cobra por unidade de uso."
      >
        <div className="space-y-3">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Provedor</Label>
              <Input value={form.provedor} onChange={(e) => setForm((f) => ({ ...f, provedor: e.target.value }))} placeholder="Ex.: AssemblyAI" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} placeholder="Ex.: universal-2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <select
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value as UnidadePrecoIA }))}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>{u.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço (US$)</Label>
              <Input type="number" step="0.000001" value={form.preco_usd} onChange={(e) => setForm((f) => ({ ...f, preco_usd: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button size="sm" loading={salvando} onClick={salvar}>
              {editandoId ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
