import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { Notificacao } from '@/types/database';
import { Bell, BellOff, ArrowLeft } from 'lucide-react';

export function NotificacoesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [lidas, setLidas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregar() {
    setCarregando(true);
    const [{ data: notifs }, { data: leituras }] = await Promise.all([
      supabase.from('notificacoes').select('*').order('criado_em', { ascending: false }),
      user ? supabase.from('notificacoes_leituras').select('id_notificacao').eq('id_usuario', user.id) : Promise.resolve({ data: [] }),
    ]);
    setNotificacoes((notifs as Notificacao[]) || []);
    setLidas(new Set(((leituras as { id_notificacao: string }[]) || []).map((l) => l.id_notificacao)));
    setCarregando(false);
  }

  async function marcarComoLida(id_notificacao: string) {
    if (!user || lidas.has(id_notificacao)) return;
    setLidas((prev) => new Set(prev).add(id_notificacao));
    await supabase.from('notificacoes_leituras').insert({ id_notificacao, id_usuario: user.id });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-teal-600" />
            Notificações
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Avisos enviados pela equipe da Falari.</p>
        </div>

        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : notificacoes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BellOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma notificação por enquanto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notificacoes.map((n) => {
              const lida = lidas.has(n.id_notificacao);
              return (
                <Card
                  key={n.id_notificacao}
                  className={lida ? 'opacity-70' : 'border-teal-300 shadow-md shadow-teal-50'}
                  onClick={() => marcarComoLida(n.id_notificacao)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-900">{n.titulo}</h3>
                      {!lida && <span className="shrink-0 w-2 h-2 rounded-full bg-teal-500 mt-1.5" />}
                    </div>
                    <div
                      className="text-sm text-slate-600 prose-sm max-w-none [&_img]:rounded-lg [&_img]:mt-2 [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: n.corpo_html }}
                    />
                    <p className="text-xs text-slate-400 mt-3">{formatDate(n.criado_em)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
