import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { formatSegmentoLabel, formatCurrency, cn } from '@/lib/utils';
import type { Plano, SegmentoUso } from '@/types/database';
import { Logo } from '@/components/Logo';
import { ArrowRight, Check } from 'lucide-react';

const SEGMENTOS: SegmentoUso[] = [
  'juridico',
  'empresarial',
  'academico',
  'saude',
  'jornalismo',
  'pessoal',
  'outro',
];

export function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [idPlanoEscolhido, setIdPlanoEscolhido] = useState('');
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    segmento: '' as SegmentoUso | '',
    profissao: '',
    registro: '',
  });

  useEffect(() => {
    supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => {
        const lista = (data as Plano[]) || [];
        setPlanos(lista);
        if (lista.length > 0) setIdPlanoEscolhido(lista[0].id_plano);
      });
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nome || !form.email || !form.senha || !form.segmento) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (form.senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: {
          nome: form.nome,
          segmento_uso: form.segmento,
          profissao: form.profissao || undefined,
          registro_profissional: form.registro || undefined,
          plano_escolhido: idPlanoEscolhido || undefined,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="shadow-lg shadow-slate-200/50">
          <CardHeader>
            <CardTitle>Criar sua conta</CardTitle>
            <CardDescription>
              Teste gratuito por 7 dias. Sem cartão de crédito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome" required>Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => update('nome', e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" required>E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="senha" required>Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => update('senha', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label required>Como você pretende usar a plataforma?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SEGMENTOS.map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => update('segmento', seg)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                        form.segmento === seg
                          ? 'border-teal-600 bg-teal-50 text-teal-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      {formatSegmentoLabel(seg)}
                      {form.segmento === seg && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {planos.length > 0 && (
                <div className="space-y-2">
                  <Label>Plano (você começa com 7 dias grátis nesse plano)</Label>
                  <div className="space-y-2">
                    {planos.map((p) => (
                      <button
                        key={p.id_plano}
                        type="button"
                        onClick={() => setIdPlanoEscolhido(p.id_plano)}
                        className={cn(
                          'w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all',
                          idPlanoEscolhido === p.id_plano
                            ? 'border-teal-600 bg-teal-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.nome}</p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(p.preco_mensal)}/mês · {formatCurrency(p.preco_anual)}/ano
                          </p>
                        </div>
                        {idPlanoEscolhido === p.id_plano && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    O pagamento por cartão ainda está sendo configurado — por enquanto, sem cartão de
                    crédito mesmo, e a gente avisa quando estiver pronto pra antecipar o pagamento.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="profissao">Profissão (opcional)</Label>
                <Input
                  id="profissao"
                  value={form.profissao}
                  onChange={(e) => update('profissao', e.target.value)}
                  placeholder="Ex.: Advogado, Jornalista, Pesquisador"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="registro">Registro profissional (opcional)</Label>
                <Input
                  id="registro"
                  value={form.registro}
                  onChange={(e) => update('registro', e.target.value)}
                  placeholder="Ex.: OAB/SP 123456"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Criar conta gratuita
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-4">
              Já tem conta?{' '}
              <Link to="/login" className="text-teal-600 font-medium hover:text-teal-700">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
