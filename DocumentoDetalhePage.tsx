import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import type { DocumentoGerado, DocumentoVersao } from '@/types/database';
import { ArrowLeft, Printer } from 'lucide-react';

export function DocumentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documento, setDocumento] = useState<DocumentoGerado | null>(null);
  const [versao, setVersao] = useState<DocumentoVersao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: doc } = await supabase.from('documentos_gerados').select('*').eq('id_documento', id).maybeSingle();
      const { data: vers } = await supabase
        .from('documentos_versoes')
        .select('*')
        .eq('id_documento', id)
        .order('numero_versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      setDocumento(doc as DocumentoGerado | null);
      setVersao(vers as DocumentoVersao | null);
      setCarregando(false);
    })();
  }, [id]);

  function handleExportar() {
    window.print();
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <p className="text-center text-slate-500 mt-10 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!documento || !versao) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <p className="text-center text-slate-500 mt-10 text-sm">Documento não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @media print {
          @page { margin: 2cm 2cm 2cm 3.5cm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
        }
      `}</style>
      <div className="print:hidden">
        <AppHeader />
      </div>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button
            onClick={() => navigate('/documentos')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Printer className="w-3.5 h-3.5" />
            Exportar / Imprimir
          </Button>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-4 print:hidden">{documento.titulo}</h1>

        <Card className="print:shadow-none print:border-none">
          <CardContent
            className="p-8 print:p-0 text-sm text-slate-800 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3"
            style={{ lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: versao.conteudo_html }}
          />
        </Card>

        <p className="text-xs text-slate-400 mt-4 print:mt-8 text-center">
          Documento gerado automaticamente por inteligência artificial a partir de uma transcrição.
          Revisão humana é recomendada antes de qualquer uso oficial.
        </p>
      </main>
    </div>
  );
}
