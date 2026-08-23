import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { Plano } from '@/types/database';
import { Plus, Pencil, Power, Clock, FileText, FileCheck2, MessageSquare, Users } from 'lucide-react';

type FormPlano = Omit<Plano, 'id_plano'>;

const PLANO_VAZIO: FormPlano = {
  nome: '',
  preco_mensal: 0,
  preco_anual: 0,
  limite_minutos_transcricao: 0,
  limite_documentos: 0,
  limite_documentos_tecnicos: 0,
  limite_mensagens_ia: 0,
  limite_membros: 1,
  ativo: true,
  ordem: 0,
};

export function AbaPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormPlano>(PLANO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('planos').select('*').order('ordem');
    setPlanos((data as Plano[]) || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriar() {
    setEditandoId(null);
    setForm(PLANO_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(plano: Plano) {
    setEditandoId(plano.id_plano);
    const { id_plano: _id_plano, ...resto } = plano;
    void _id_plano;
    setForm(resto);
    setErro(null);
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro('Informe o nome do plano.');
      return;
    }
    setSalvando(true);
    setErro(null);

    const { error } = editandoId
      ? await supabase.from('planos').update(form).eq('id_plano', editandoId)
      : await supabase.from('planos').insert(form);

    if (error) {
      setErro(error.message);
    } else {
      setModalAberto(false);
      await carregar();
    }
    setSalvando(false);
  }

  async function alternarAtivo(plano: Plano) {
    setAlternandoId(plano.id_plano);
    const { error } = await supabase.from('planos').update({ ativo: !plano.ativo }).eq('id_plano', plano.id_plano);
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
            <CardTitle>Planos existentes ({planos.length})</CardTitle>
            <CardDescription>Planos disponíveis para contratação e seus limites por ciclo.</CardDescription>
          </div>
          <Button size="sm" onClick={abrirCriar}>
            <Plus className="w-3.5 h-3.5" />
            Criar plano
          </Button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : planos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum plano cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {planos.map((plano) => (
                <div
                  key={plano.id_plano}
                  className={`rounded-lg border px-4 py-3 ${plano.ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{plano.nome}</p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(plano.preco_mensal)}/mês · {formatCurrency(plano.preco_anual)}/ano
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => abrirEditar(plano)}>
                        <Pencil className="w-3.5 h-3.5" />
                        Alterar
                      </Button>
                      <Button
                        size="sm"
                        variant={plano.ativo ? 'outline' : 'primary'}
                        loading={alternandoId === plano.id_plano}
                        onClick={() => alternarAtivo(plano)}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {plano.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{plano.limite_minutos_transcricao} min de transcrição</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{plano.limite_documentos} documentos</span>
                    <span className="flex items-center gap-1"><FileCheck2 className="w-3.5 h-3.5" />{plano.limite_documentos_tecnicos} doc. técnicos</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{plano.limite_mensagens_ia} mensagens IA</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />até {plano.limite_membros} membros</span>
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
        titulo={editandoId ? 'Alterar plano' : 'Criar novo plano'}
        descricao="Nome, preços e limites de cada tipo de crédito por ciclo."
      >
        <div className="space-y-3">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Premium" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Preço mensal (R$)</Label>
              <Input type="number" value={form.preco_mensal} onChange={(e) => setForm((f) => ({ ...f, preco_mensal: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço anual (R$)</Label>
              <Input type="number" value={form.preco_anual} onChange={(e) => setForm((f) => ({ ...f, preco_anual: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Membros permitidos</Label>
              <Input type="number" value={form.limite_membros} onChange={(e) => setForm((f) => ({ ...f, limite_membros: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minutos de transcrição/ciclo</Label>
              <Input type="number" value={form.limite_minutos_transcricao} onChange={(e) => setForm((f) => ({ ...f, limite_minutos_transcricao: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Documentos/ciclo</Label>
              <Input type="number" value={form.limite_documentos} onChange={(e) => setForm((f) => ({ ...f, limite_documentos: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Doc. técnicos/ciclo</Label>
              <Input type="number" value={form.limite_documentos_tecnicos} onChange={(e) => setForm((f) => ({ ...f, limite_documentos_tecnicos: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagens IA/ciclo</Label>
              <Input type="number" value={form.limite_mensagens_ia} onChange={(e) => setForm((f) => ({ ...f, limite_mensagens_ia: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ordem de exibição</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button size="sm" loading={salvando} onClick={salvar}>
              {editandoId ? 'Salvar alterações' : 'Criar plano'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
