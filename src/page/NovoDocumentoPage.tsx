import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gerarDocumento } from '@/lib/iaGateway';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Sparkles, ArrowLeft } from 'lucide-react';

export function NovoDocumentoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  const idTranscricao = params.get('id_transcricao');
  const idModelo = params.get('id_modelo');

  useEffect(() => {
    if (!idTranscricao || !idModelo) {
      setErro('Parâmetros ausentes. Volte e escolha um modelo a partir de uma transcrição.');
      return;
    }

    gerarDocumento({ id_transcricao: idTranscricao, id_modelo: idModelo })
      .then((res) => navigate(`/documentos/${res.id_documento}`, { replace: true }))
      .catch((err) => setErro(err instanceof Error ? err.message : 'Falha ao gerar o documento.'));
  }, [idTranscricao, idModelo, navigate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-16">
        <Card>
          <CardHeader className="items-center text-center">
            {!erro ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-6 h-6 text-amber-600 animate-pulse" />
                </div>
                <CardTitle>Gerando documento com IA...</CardTitle>
                <CardDescription>Isso leva alguns segundos.</CardDescription>
              </>
            ) : (
              <CardTitle className="text-red-700">Não foi possível gerar o documento</CardTitle>
            )}
          </CardHeader>
          {erro && (
            <CardContent className="space-y-3">
              <p className="text-sm text-red-600 text-center">{erro}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/transcricoes')}>
                <ArrowLeft className="w-4 h-4" />
                Voltar para transcrições
              </Button>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}
