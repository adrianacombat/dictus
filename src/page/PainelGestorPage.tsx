import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { cn } from '@/lib/utils';
import { AbaContas } from '@/pages/gestor/AbaContas';
import { AbaPlanos } from '@/pages/gestor/AbaPlanos';
import { AbaPacotes } from '@/pages/gestor/AbaPacotes';
import { AbaConsumo } from '@/pages/gestor/AbaConsumo';
import { AbaNotificacoes } from '@/pages/gestor/AbaNotificacoes';
import { AbaSuporte } from '@/pages/gestor/AbaSuporte';
import { AbaPromptsIA } from '@/pages/gestor/AbaPromptsIA';
import { AbaAuditoria } from '@/pages/gestor/AbaAuditoria';
import { AbaPrecosIA } from '@/pages/gestor/AbaPrecosIA';
import { AbaPagamentos } from '@/pages/gestor/AbaPagamentos';
import { ShieldCheck, Building2, CreditCard, Package, BarChart3, Bell, LifeBuoy, Bot, ShieldAlert, DollarSign, Wallet } from 'lucide-react';

type Aba = 'contas' | 'planos' | 'pacotes' | 'consumo' | 'notificacoes' | 'suporte' | 'prompts_ia' | 'precos_ia' | 'pagamentos' | 'auditoria';

const ABAS: { valor: Aba; label: string; icone: typeof Building2 }[] = [
  { valor: 'contas', label: 'Contas', icone: Building2 },
  { valor: 'planos', label: 'Planos', icone: CreditCard },
  { valor: 'pacotes', label: 'Pacotes de crédito', icone: Package },
  { valor: 'consumo', label: 'Consumo da plataforma', icone: BarChart3 },
  { valor: 'precos_ia', label: 'Preços de IA', icone: DollarSign },
  { valor: 'pagamentos', label: 'Pagamentos', icone: Wallet },
  { valor: 'notificacoes', label: 'Notificações', icone: Bell },
  { valor: 'suporte', label: 'Suporte', icone: LifeBuoy },
  { valor: 'prompts_ia', label: 'Instruções de IA', icone: Bot },
  { valor: 'auditoria', label: 'Auditoria', icone: ShieldAlert },
];

export function PainelGestorPage() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>('contas');

  if (usuario && usuario.papel !== 'gestor_plataforma') {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Esta área é restrita ao gestor da plataforma.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Painel do Gestor da Plataforma</h1>
            <p className="text-slate-500 text-sm">Contas, planos, créditos, pacotes e consumo — tudo em um só lugar.</p>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              type="button"
              onClick={() => setAba(a.valor)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                aba === a.valor
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <a.icone className="w-4 h-4" />
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'contas' && <AbaContas />}
        {aba === 'planos' && <AbaPlanos />}
        {aba === 'pacotes' && <AbaPacotes />}
        {aba === 'consumo' && <AbaConsumo />}
        {aba === 'notificacoes' && <AbaNotificacoes />}
        {aba === 'suporte' && <AbaSuporte />}
        {aba === 'precos_ia' && <AbaPrecosIA />}
        {aba === 'pagamentos' && <AbaPagamentos />}
        {aba === 'prompts_ia' && <AbaPromptsIA />}
        {aba === 'auditoria' && <AbaAuditoria />}
      </main>
    </div>
  );
}
