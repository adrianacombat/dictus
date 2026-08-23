import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { LogOut, Bell, User, LifeBuoy, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Início' },
  { to: '/transcricoes', label: 'Transcrições' },
  { to: '/documentos', label: 'Documentos' },
  { to: '/assistente', label: 'Assistente IA' },
  { to: '/relatorios', label: 'Relatórios' },
];

const NAV_GESTOR = { to: '/gestor', label: 'Gestor da plataforma' };

export function AppHeader() {
  const { user, usuario, signOut } = useAuth();
  const { tema, alternarTema } = useTheme();
  const location = useLocation();
  const [naoLidas, setNaoLidas] = useState(0);

  const itensNav = usuario?.papel === 'gestor_plataforma' ? [...NAV, NAV_GESTOR] : NAV;

  useEffect(() => {
    if (!user) return;
    let ativo = true;

    async function contarNaoLidas() {
      const { data: notifs } = await supabase.from('notificacoes').select('id_notificacao');
      const { data: leituras } = await supabase.from('notificacoes_leituras').select('id_notificacao').eq('id_usuario', user!.id);
      if (!ativo) return;
      const lidasSet = new Set((leituras || []).map((l: { id_notificacao: string }) => l.id_notificacao));
      const total = (notifs || []).filter((n: { id_notificacao: string }) => !lidasSet.has(n.id_notificacao)).length;
      setNaoLidas(total);
    }

    contarNaoLidas();
    return () => {
      ativo = false;
    };
  }, [user, location.pathname]);

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/dashboard" className="shrink-0">
            <Logo size="sm" compact />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {itensNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith(item.to)
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={alternarTema}
            title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-slate-500 hover:bg-slate-100"
          >
            {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link
            to="/notificacoes"
            title="Notificações"
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              location.pathname.startsWith('/notificacoes') ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            <Bell className="w-4 h-4" />
            {naoLidas > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </Link>
          <Link
            to="/suporte"
            title="Suporte"
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              location.pathname.startsWith('/suporte') ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            <LifeBuoy className="w-4 h-4" />
          </Link>
          <Link
            to="/perfil"
            title="Meu perfil"
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              location.pathname.startsWith('/perfil') ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            <User className="w-4 h-4" />
          </Link>
          <span className="text-sm text-slate-600 hidden lg:block ml-1">{usuario?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {itensNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              location.pathname.startsWith(item.to)
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
