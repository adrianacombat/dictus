import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Building2, Clock, FileText, DollarSign, Users, Mic } from 'lucide-react';

function formatUsd(valor: number): string {
  return `US$ ${valor.toFixed(4)}`;
}

interface Estatisticas {
  totalContas: number;
  contasTrial: number;
  contasAtivas: number;
  contasSuspensas: number;
  totalTranscricoes: number;
  totalDocumentos: number;
  minutosTranscritos: number;
  custoTotalUsd: number;
}

interface LinhaConta {
  id_conta: string;
  nome: string;
  minutosTranscricao: number;
  custoTranscricao: number;
  qtdDocumentos: number;
  custoDocumentos: number;
  qtdChat: number;
  custoChat: number;
  custoTotal: number;
}

export function AbaConsumo() {
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [porConta, setPorConta] = useState<LinhaConta[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: contas }, { count: totalTranscricoes }, { count: totalDocumentos }, { data: transConcluidas }, { data: consumo }] =
        await Promise.all([
          supabase.from('contas').select('id_conta, nome, status'),
          supabase.from('transcricoes').select('*', { count: 'exact', head: true }),
          supabase.from('documentos_gerados').select('*', { count: 'exact', head: true }),
          supabase.from('transcricoes').select('id_conta, duracao_segundos').eq('status', 'concluido'),
          supabase.from('consumo_ia_log').select('id_conta, finalidade, custo_usd'),
        ]);

      const totalContas = contas?.length ?? 0;
      const contasTrial = contas?.filter((c) => c.status === 'trial').length ?? 0;
      const contasAtivas = contas?.filter((c) => c.status === 'ativo').length ?? 0;
      const contasSuspensas = contas?.filter((c) => c.status === 'suspenso').length ?? 0;
      const minutosTranscritos = Math.round(
        (transConcluidas || []).reduce((soma, t) => soma + (t.duracao_segundos || 0), 0) / 60,
      );
      const custoTotalUsd = (consumo || []).reduce((soma, c) => soma + Number(c.custo_usd || 0), 0);

      setStats({
        totalContas,
        contasTrial,
        contasAtivas,
        contasSuspensas,
        totalTranscricoes: totalTranscricoes ?? 0,
        totalDocumentos: totalDocumentos ?? 0,
        minutosTranscritos,
        custoTotalUsd,
      });

      // Monta a tabela por conta: minutos de transcrição vêm de "transcricoes"
      // (duração real gravada), o resto (documentos/chat, com custo) vem do
      // log de consumo, que já é lançado por finalidade em cada ação da IA.
      const nomesPorConta = Object.fromEntries((contas || []).map((c) => [c.id_conta, c.nome]));
      const linhas = new Map<string, LinhaConta>();

      function linha(id_conta: string): LinhaConta {
        let l = linhas.get(id_conta);
        if (!l) {
          l = {
            id_conta,
            nome: nomesPorConta[id_conta] || 'Conta removida',
            minutosTranscricao: 0,
            custoTranscricao: 0,
            qtdDocumentos: 0,
            custoDocumentos: 0,
            qtdChat: 0,
            custoChat: 0,
            custoTotal: 0,
          };
          linhas.set(id_conta, l);
        }
        return l;
      }

      for (const t of transConcluidas || []) {
        if (!t.id_conta) continue;
        linha(t.id_conta).minutosTranscricao += Math.round((t.duracao_segundos || 0) / 60);
      }

      for (const c of consumo || []) {
        if (!c.id_conta) continue;
        const l = linha(c.id_conta);
        const custo = Number(c.custo_usd || 0);
        l.custoTotal += custo;
        if (c.finalidade === 'transcricao') l.custoTranscricao += custo;
        else if (c.finalidade === 'documento') {
          l.qtdDocumentos += 1;
          l.custoDocumentos += custo;
        } else if (c.finalidade === 'chat') {
          l.qtdChat += 1;
          l.custoChat += custo;
        }
      }

      setPorConta([...linhas.values()].sort((a, b) => b.custoTotal - a.custoTotal));
      setCarregando(false);
    })();
  }, []);

  const cards = [
    { icone: Building2, label: 'Contas no total', valor: stats?.totalContas ?? 0, cor: 'text-slate-600 bg-slate-100' },
    { icone: Users, label: 'Trial / Ativas / Suspensas', valor: `${stats?.contasTrial ?? 0} / ${stats?.contasAtivas ?? 0} / ${stats?.contasSuspensas ?? 0}`, cor: 'text-blue-600 bg-blue-50' },
    { icone: Mic, label: 'Minutos transcritos (AssemblyAI)', valor: stats?.minutosTranscritos ?? 0, cor: 'text-teal-600 bg-teal-50' },
    { icone: FileText, label: 'Transcrições / Documentos', valor: `${stats?.totalTranscricoes ?? 0} / ${stats?.totalDocumentos ?? 0}`, cor: 'text-amber-600 bg-amber-50' },
    { icone: DollarSign, label: 'Custo estimado de IA (USD)', valor: `US$ ${(stats?.custoTotalUsd ?? 0).toFixed(2)}`, cor: 'text-red-600 bg-red-50' },
    { icone: Clock, label: '', valor: '', cor: 'hidden' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards
          .filter((c) => c.label)
          .map((c) => (
            <Card key={c.label}>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.cor}`}>
                  <c.icone className="w-4 h-4" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{carregando ? '—' : c.valor}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custo estimado por cliente</CardTitle>
          <CardDescription>
            Baseado nos preços cadastrados na aba "Preços de IA" e no consumo real registrado a cada
            transcrição, documento gerado e mensagem de chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : porConta.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum consumo registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Conta</th>
                    <th className="py-2 pr-3 font-medium">Min. transcritos</th>
                    <th className="py-2 pr-3 font-medium">Documentos</th>
                    <th className="py-2 pr-3 font-medium">Mensagens chat</th>
                    <th className="py-2 font-medium text-right">Custo total (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {porConta.map((l) => (
                    <tr key={l.id_conta} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 text-slate-800 font-medium">{l.nome}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.minutosTranscricao}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.qtdDocumentos}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.qtdChat}</td>
                      <td className="py-2 text-right text-slate-800 font-medium">{formatUsd(l.custoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Custo estimado de IA é somado a partir do registro de cada chamada (transcrição, geração de
        documento, chat) em consumo_ia_log. Os valores de referência (preço por minuto/token) ficam
        na aba "Preços de IA" — atualize lá se o provedor mudar o preço.
      </p>
    </div>
  );
}
