import { useEffect, useRef, useState, type FormEvent } from 'react';
import { enviarMensagemChat } from '@/lib/iaGateway';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Mensagem {
  papel: 'user' | 'assistant';
  conteudo: string;
}

export function AssistenteIAPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;

    const mensagemUsuario: Mensagem = { papel: 'user', conteudo: texto.trim() };
    const historico = mensagens;
    setMensagens((m) => [...m, mensagemUsuario]);
    setTexto('');
    setEnviando(true);
    setErro(null);

    try {
      const res = await enviarMensagemChat({ mensagem: mensagemUsuario.conteudo, historico });
      setMensagens((m) => [...m, { papel: 'assistant', conteudo: res.resposta }]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Assistente IA</h1>
          <p className="text-slate-500 mt-1 text-sm">Tire dúvidas sobre suas transcrições, documentos e o uso da plataforma.</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[300px]">
          {mensagens.length === 0 && (
            <div className="text-center text-slate-400 text-sm mt-12">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Envie uma mensagem para começar.
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={cn('flex', m.papel === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                  m.papel === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-800',
                )}
              >
                {m.conteudo}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">{erro}</div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 pb-4">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva sua mensagem..."
            disabled={enviando}
          />
          <Button type="submit" disabled={!texto.trim()} loading={enviando}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
