import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { formatCurrency } from '@/lib/utils';
import type { Plano } from '@/types/database';
import { AlertTriangle, LogOut, LifeBuoy } from 'lucide-react';

export function AssinaturaBloqueadaPage() {
  const { conta, signOut } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);

  useEffect(() => {
    supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => setPlanos((data as Plano[]) || []));
  }, []);

  const motivo =
    conta?.status === 'suspenso'
      ? 'Sua conta está suspensa pelo gestor da plataforma.'
      : conta?.status === 'cancelado'
        ? 'Sua conta foi cancelada.'
        : 'Seu período de teste gratuito de 7 dias acabou.';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="shadow-lg shadow-slate-200/50">
          <CardHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <CardTitle>Acesso temporariamente bloqueado</CardTitle>
            <CardDescription>{motivo} Escolha um plano para continuar usando a plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planos.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {planos.map((p) => (
                  <div key={p.id_plano} className="rounded-lg border border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{p.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatCurrency(p.preco_mensal)}/mês · {formatCurrency(p.preco_anual)}/ano
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-500">
              O pagamento online por cartão ainda está sendo configurado. Por enquanto, fale com o
              suporte pra liberar sua conta com o plano escolhido.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => signOut()}>
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
              <a href="mailto:suporte@falari.app" className="flex-1">
                <Button className="w-full">
                  <LifeBuoy className="w-4 h-4" />
                  Falar com o suporte
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
