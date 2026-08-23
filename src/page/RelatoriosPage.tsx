import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type { CreditoMovimento, CreditoSaldo } from '@/types/database';
import { Clock, FileText, Sparkles, ShieldCheck } from 'lucide-react';

const ORIGEM_LABEL: Record<string, string> = {
  plano_mensal: 'Plano mensal',
  pacote_avulso: 'Pacote avulso',
  consumo_transcricao: 'Consumo — transcrição',
  consumo_documento: 'Consumo — documento/mensagem',
  ajuste_manual: 'Ajuste manual',
};

export function RelatoriosPage() {
  const { conta } = useAuth();
  const [saldo, setSaldo] = useState<CreditoSaldo | null>(null);
  const [movimentos, setMovimentos] = useState<CreditoMovimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!conta) return;
    (async () => {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from('credito_saldo').select('*').eq('id_conta', conta.id_conta).maybeSingle(),
        supabase
          .from('credito_movimentos')
          .select('*')
          .eq('id_conta', conta.id_conta)
          .order('criado_em', { ascending: false })
          .limit(20),
      ]);
      setSaldo(s as CreditoSaldo | null);
      setMovimentos((m as CreditoMovimento[]) || []);
      setCarregando(false);
    })();
  }, [conta]);

  const cards = [
    { icon: Clock, label: 'Minutos de transcrição', valor: saldo?.minutos_disponiveis ?? 0, color: 'text-teal-600 bg-teal-50' },
    { icon: FileText, label: 'Documentos', valor: saldo?.documentos_disponiveis ?? 0, color: 'text-blue-600 bg-blue-50' },
    { icon: ShieldCheck, label: 'Documentos técnicos', valor: saldo?.documentos_tecnicos_disponiveis ?? 0, color: 'text-amber-600 bg-amber-50' },
    { icon: Sparkles, label: 'Mensagens IA', valor: saldo?.mensagens_ia_disponiveis ?? 0, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-slate-500 mt-1 text-sm">Saldo de créditos e histórico de consumo da conta.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
                  <c.icon className="w-4 h-4" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{carregando ? '—' : c.valor}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimentações recentes</CardTitle>
            <CardDescription>Últimos créditos e consumos registrados na conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : movimentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma movimentação registrada ainda.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {movimentos.map((mv) => (
                  <div key={mv.id_movimento} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-800">{ORIGEM_LABEL[mv.origem] || mv.origem}</p>
                      <p className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(mv.criado_em))}
                      </p>
                    </div>
                    <span className={`font-medium ${Number(mv.quantidade) < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                      {Number(mv.quantidade) > 0 ? '+' : ''}
                      {mv.quantidade} {mv.tipo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
