import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type { PromptIA } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { Bot, Plus, Pencil, Power } from 'lucide-react';

const TIPO_LABEL: Record<string, string> = {
  relatorio_tecnico_transcricao: 'Relatório Técnico de Transcrição (jurídico)',
};

export function AbaPromptsIA() {
  const [prompts, setPrompts] = useState<PromptIA[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  const [editando, setEditando] = useState<PromptIA | null>(null);
  const [tipoSaida, setTipoSaida] = useState('');
  const [modeloIa, setModeloIa] = useState('claude-sonnet-4-5');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('prompts_ia')
      .select('*')
      .order('tipo_saida')
      .order('versao', { ascending: false });
    const todos = (data as PromptIA[]) || [];
    // Um card por tipo_saida, sempre a versão mais recente dele.
    const maisRecentePorTipo = new Map<string, PromptIA>();
    for (const p of todos) {
      if (!maisRecentePorTipo.has(p.tipo_saida)) maisRecentePorTipo.set(p.tipo_saida, p);
    }
    setPrompts([...maisRecentePorTipo.values()]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setModoNovo(true);
    setEditando(null);
    setTipoSaida('');
    setModeloIa('claude-sonnet-4-5');
    setTexto('');
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(p: PromptIA) {
    setModoNovo(false);
    setEditando(p);
    setTipoSaida(p.tipo_saida);
    setModeloIa(p.modelo_ia);
    setTexto(p.texto_prompt);
    setErro(null);
    setModalAberto(true);
  }

  async function salvar() {
    if (!tipoSaida.trim() || !texto.trim()) {
      setErro('Preencha o tipo de documento e o texto da instrução.');
      return;
    }
    setSalvando(true);
    setErro(null);

    if (modoNovo) {
      const { error } = await supabase.from('prompts_ia').insert({
        tipo_saida: tipoSaida.trim(),
        modelo_ia: modeloIa.trim() || 'claude-sonnet-4-5',
        texto_prompt: texto,
        versao: 1,
        ativo: true,
      });
      if (error) {
        setErro(error.message);
        setSalvando(false);
        return;
      }
    } else if (editando) {
      // Mantém histórico: desativa a versão atual e insere uma nova versão
      // ativa (mesma lógica que gerar_documento usa para achar a vigente).
      const { error: errDesativar } = await supabase
        .from('prompts_ia')
        .update({ ativo: false })
        .eq('id_prompt', editando.id_prompt);
      if (errDesativar) {
        setErro(errDesativar.message);
        setSalvando(false);
        return;
      }
      const { error: errInserir } = await supabase.from('prompts_ia').insert({
        tipo_saida: editando.tipo_saida,
        modelo_ia: modeloIa.trim() || 'claude-sonnet-4-5',
        texto_prompt: texto,
        versao: (editando.versao || 1) + 1,
        ativo: true,
      });
      if (errInserir) {
        setErro(errInserir.message);
        setSalvando(false);
        return;
      }
    }

    setModalAberto(false);
    await carregar();
    setSalvando(false);
  }

  async function alternarAtivo(p: PromptIA) {
    setAlternandoId(p.id_prompt);
    const { error } = await supabase.from('prompts_ia').update({ ativo: !p.ativo }).eq('id_prompt', p.id_prompt);
    if (error) setErro(error.message);
    await carregar();
    setAlternandoId(null);
  }

  return (
    <div className="space-y-6">
      {erro && !modalAberto && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Instruções de IA ({prompts.length})
            </CardTitle>
            <CardDescription>
              Uma instrução por tipo de documento/peça que a IA pode gerar. Editar cria uma nova
              versão (o histórico anterior fica guardado); excluir só desativa, não apaga.
            </CardDescription>
          </div>
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="w-3.5 h-3.5" />
            Cadastrar instrução
          </Button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : prompts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma instrução de IA cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {prompts.map((p) => (
                <div
                  key={p.id_prompt}
                  className={`rounded-lg border px-4 py-3 ${p.ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{TIPO_LABEL[p.tipo_saida] || p.tipo_saida}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.modelo_ia} · v{p.versao} · {formatDate(p.criado_em)} · {p.ativo ? 'Ativa' : 'Inativa'}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => abrirEditar(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                        Alterar
                      </Button>
                      <Button
                        size="sm"
                        variant={p.ativo ? 'outline' : 'primary'}
                        loading={alternandoId === p.id_prompt}
                        onClick={() => alternarAtivo(p)}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {p.ativo ? 'Excluir' : 'Ativar'}
                      </Button>
                    </div>
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
        titulo={modoNovo ? 'Cadastrar instrução de IA' : 'Alterar instrução de IA'}
        descricao="Texto que orienta a IA a gerar esse tipo de documento/peça."
        className="max-w-2xl"
      >
        <div className="space-y-3">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de documento (chave técnica)</Label>
              <Input
                value={tipoSaida}
                onChange={(e) => setTipoSaida(e.target.value)}
                disabled={!modoNovo}
                placeholder="Ex.: relatorio_tecnico_transcricao"
              />
              {modoNovo && (
                <p className="text-[11px] text-slate-400">
                  Precisa bater com o "tipo_saida" do modelo de documento correspondente (cadastro em
                  Gestão de Docs). Use letras minúsculas e underline.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo de IA</Label>
              <Input value={modeloIa} onChange={(e) => setModeloIa(e.target.value)} placeholder="Ex.: claude-sonnet-4-5" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Instrução (prompt)</Label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button size="sm" loading={salvando} onClick={salvar}>
              {modoNovo ? 'Cadastrar' : 'Salvar nova versão'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
