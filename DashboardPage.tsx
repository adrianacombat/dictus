import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatDate, formatSegmentoLabel, daysUntil } from '@/lib/utils';
import {
  Mic,
  Clock,
  FileText,
  Sparkles,
  TrendingUp,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

export function DashboardPage() {
  const { usuario, conta, profileMissing, refreshProfile, user } = useAuth();

  if (!conta || !usuario) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          {profileMissing ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Sua conta está sendo configurada
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Tivemos um problema ao carregar os dados da sua conta. Tente novamente.
              </p>
              <Button onClick={() => refreshProfile()} size="md">
                Tentar novamente
              </Button>
              <p className="text-xs text-slate-400 mt-3">
                {user?.email}
              </p>
            </>
          ) : (
            <>
              <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-slate-500 mt-3 text-sm">Carregando...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const trialDays = conta.trial_fim ? daysUntil(conta.trial_fim) : 0;
  const trialActive = conta.status === 'trial' && trialDays > 0;
  const trialExpired = conta.status === 'trial' && trialDays <= 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{conta.nome}</h1>
          <p className="text-slate-500 mt-1">
            {formatSegmentoLabel(conta.segmento_uso)} · Conta {conta.tipo_conta}
          </p>
        </div>

        {/* Trial status banner */}
        <div
          className={`rounded-xl border p-5 mb-8 ${
            trialActive
              ? 'bg-teal-50 border-teal-200'
              : trialExpired
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                trialActive
                  ? 'bg-teal-600'
                  : trialExpired
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
              }`}
            >
              {trialActive ? (
                <Clock className="w-5 h-5 text-white" />
              ) : trialExpired ? (
                <Calendar className="w-5 h-5 text-white" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">
                {trialActive
                  ? `Trial — expira em ${trialDays} ${trialDays === 1 ? 'dia' : 'dias'}`
                  : trialExpired
                    ? 'Trial expirado'
                    : `Status: ${conta.status}`}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {trialActive
                  ? `Seu período de teste termina em ${formatDate(conta.trial_fim)}. Aproveite todos os recursos.`
                  : trialExpired
                    ? 'Seu período de teste terminou. Escolha um plano para continuar usando a plataforma.'
                    : `Conta criada em ${formatDate(conta.criado_em)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { to: '/transcricoes', icon: Mic, label: 'Transcrições', desc: 'Áudio e vídeo por IA', color: 'text-teal-600' },
            { to: '/documentos', icon: FileText, label: 'Documentos', desc: 'Geração automática', color: 'text-blue-600' },
            { to: '/assistente', icon: Sparkles, label: 'Assistente IA', desc: 'Chat inteligente', color: 'text-amber-600' },
            { to: '/relatorios', icon: TrendingUp, label: 'Relatórios', desc: 'Métricas e consumo', color: 'text-slate-600' },
          ].map((item) => (
            <Link key={item.label} to={item.to}>
              <Card className="hover:shadow-md hover:border-teal-300 transition-all h-full">
                <CardContent className="p-5">
                  <item.icon className={`w-6 h-6 ${item.color} mb-3`} />
                  <h3 className="font-semibold text-slate-900 text-sm">{item.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo(a)!</CardTitle>
            <CardDescription>
              Clique em um dos módulos acima para começar a transcrever, gerar documentos ou conversar
              com o assistente de IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nome</p>
                <p className="text-sm text-slate-900">{usuario.nome}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">E-mail</p>
                <p className="text-sm text-slate-900">{usuario.email}</p>
              </div>
              {usuario.profissao && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Profissão</p>
                  <p className="text-sm text-slate-900">{usuario.profissao}</p>
                </div>
              )}
              {usuario.registro_profissional && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registro</p>
                  <p className="text-sm text-slate-900">{usuario.registro_profissional}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Função</p>
                <p className="text-sm text-slate-900 capitalize">{usuario.papel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">MFA</p>
                <p className="text-sm text-slate-900">{usuario.mfa_ativo ? 'Ativo' : 'Não ativado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
