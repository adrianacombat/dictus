import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Logo } from '@/components/Logo';
import { ArrowRight, Sun, Moon, Mic, FileText, ShieldCheck } from 'lucide-react';

const DESTAQUES = [
  { icone: Mic, titulo: 'Transcrição com IA', descricao: 'Áudio e vídeo viram texto formatado, com identificação de quem fala.' },
  { icone: FileText, titulo: 'Documentos automáticos', descricao: 'Gere peças e relatórios técnicos a partir da transcrição, em segundos.' },
  { icone: ShieldCheck, titulo: 'Cadeia de custódia', descricao: 'Hash do arquivo original, origem e data — prontos para uso profissional.' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { tema, alternarTema } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !senha) {
      setError('Preencha e-mail e senha.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (signInError) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Painel de apresentação — some em telas pequenas */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative">
          <Logo size="md" className="[&_span]:text-white" />
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              Transcrição e documentos jurídicos, com IA de ponta a ponta.
            </h1>
            <p className="text-teal-100 mt-3 text-sm max-w-md">
              Grave, transcreva e transforme em peça pronta — sem sair da plataforma.
            </p>
          </div>

          <div className="space-y-5">
            {DESTAQUES.map((d) => (
              <div key={d.titulo} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <d.icone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{d.titulo}</p>
                  <p className="text-xs text-teal-100/80 mt-0.5">{d.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-teal-100/60">© {new Date().getFullYear()} Falari</p>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <button
          type="button"
          onClick={alternarTema}
          title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {tema === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center justify-center mb-8">
            <Logo size="lg" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Entrar</h2>
          <p className="text-slate-500 text-sm mb-6">Acesse sua conta para continuar.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" required>E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" required>Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Entrar
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Não tem conta?{' '}
            <Link to="/signup" className="text-teal-600 font-medium hover:text-teal-700">
              Criar conta gratuita
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
