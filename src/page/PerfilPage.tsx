import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { User, KeyRound, Building2, ArrowLeft } from 'lucide-react';

export function PerfilPage() {
  const navigate = useNavigate();
  const { usuario, conta, refreshProfile } = useAuth();

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [profissao, setProfissao] = useState(usuario?.profissao ?? '');
  const [registro, setRegistro] = useState(usuario?.registro_profissional ?? '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [sucessoPerfil, setSucessoPerfil] = useState<string | null>(null);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  const [nomeConta, setNomeConta] = useState(conta?.nome ?? '');
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [sucessoConta, setSucessoConta] = useState<string | null>(null);
  const [erroConta, setErroConta] = useState<string | null>(null);

  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [sucessoSenha, setSucessoSenha] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  if (!usuario || !conta) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <p className="text-center text-slate-500 mt-10 text-sm">Carregando...</p>
      </div>
    );
  }

  async function salvarPerfil(e: FormEvent) {
    e.preventDefault();
    setSalvandoPerfil(true);
    setErroPerfil(null);
    setSucessoPerfil(null);
    const { error } = await supabase
      .from('usuarios')
      .update({ nome, profissao: profissao || null, registro_profissional: registro || null })
      .eq('id_usuario', usuario!.id_usuario);
    if (error) setErroPerfil(error.message);
    else {
      setSucessoPerfil('Dados atualizados.');
      await refreshProfile();
    }
    setSalvandoPerfil(false);
  }

  async function salvarConta(e: FormEvent) {
    e.preventDefault();
    setSalvandoConta(true);
    setErroConta(null);
    setSucessoConta(null);
    const { error } = await supabase.from('contas').update({ nome: nomeConta }).eq('id_conta', conta!.id_conta);
    if (error) setErroConta(error.message);
    else {
      setSucessoConta('Nome da conta atualizado.');
      await refreshProfile();
    }
    setSalvandoConta(false);
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setSucessoSenha(null);

    if (senhaNova.length < 6) {
      setErroSenha('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senhaNova !== senhaConfirmacao) {
      setErroSenha('As senhas não coincidem.');
      return;
    }

    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    if (error) setErroSenha(error.message);
    else {
      setSucessoSenha('Senha atualizada.');
      setSenhaNova('');
      setSenhaConfirmacao('');
    }
    setSalvandoSenha(false);
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
          <h1 className="text-2xl font-bold text-slate-900">Meu perfil</h1>
          <p className="text-slate-500 mt-1 text-sm">Seus dados pessoais, os da conta, e sua senha.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados pessoais
            </CardTitle>
            <CardDescription>{usuario.email} · papel: {usuario.papel}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarPerfil} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profissao">Profissão</Label>
                <Input id="profissao" value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex.: Advogado" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registro">Registro profissional</Label>
                <Input id="registro" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="Ex.: OAB/SP 123456" />
              </div>
              {erroPerfil && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erroPerfil}</div>}
              {sucessoPerfil && <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-sm text-teal-700">{sucessoPerfil}</div>}
              <Button type="submit" loading={salvandoPerfil}>Salvar dados pessoais</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Dados da conta
            </CardTitle>
            <CardDescription>Nome que identifica sua conta na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={salvarConta} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nomeConta">Nome da conta</Label>
                <Input id="nomeConta" value={nomeConta} onChange={(e) => setNomeConta(e.target.value)} />
              </div>
              {erroConta && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erroConta}</div>}
              {sucessoConta && <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-sm text-teal-700">{sucessoConta}</div>}
              <Button type="submit" loading={salvandoConta} variant="outline">Salvar dados da conta</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Trocar senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={trocarSenha} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="senhaNova">Nova senha</Label>
                <Input id="senhaNova" type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senhaConfirmacao">Confirmar nova senha</Label>
                <Input id="senhaConfirmacao" type="password" value={senhaConfirmacao} onChange={(e) => setSenhaConfirmacao(e.target.value)} />
              </div>
              {erroSenha && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erroSenha}</div>}
              {sucessoSenha && <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-sm text-teal-700">{sucessoSenha}</div>}
              <Button type="submit" loading={salvandoSenha} variant="outline">Trocar senha</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
