import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate, daysUntil } from '@/lib/utils';
import type { Conta } from '@/types/database';
import { Wallet, AlertTriangle } from 'lucide-react';

export function AbaPagamentos() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from('contas')
      .select('*')
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        setContas((data as Conta[]) || []);
        setCarregando(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Integração com Stripe ainda não está ligada.</p>
          <p className="text-xs mt-0.5">
            O bloqueio automático de conta com trial vencido/suspensa já está ativo. O que falta é a
            cobrança de verdade: preciso que você crie uma conta no Stripe (stripe.com), pegue a
            chave secreta de API (modo teste primeiro, em Developers → API keys) e me passe pra eu
            configurar como segredo da Edge Function — igual fizemos com a AssemblyAI e a Anthropic.
            Assim que tiver isso, eu implemento o checkout e o webhook de confirmação de pagamento.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Contas e status de pagamento
          </CardTitle>
          <CardDescription>Status da conta, forma de pagamento e prazo de trial de cada cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Conta</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Trial até</th>
                    <th className="py-2 font-medium">Forma de pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c) => (
                    <tr key={c.id_conta} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 text-slate-800 font-medium">{c.nome}</td>
                      <td className="py-2 pr-3 text-slate-600">{c.status}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {c.status === 'trial' && c.trial_fim
                          ? `${formatDate(c.trial_fim)} (${daysUntil(c.trial_fim)} dias)`
                          : '—'}
                      </td>
                      <td className="py-2 text-slate-600">
                        {c.forma_pagamento === 'stripe' ? 'Cartão (Stripe)' : 'Nenhuma cadastrada'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
