import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/Card';
import type { DocumentoGerado } from '@/types/database';
import { FileText } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  rascunho_ia: 'Rascunho (IA)',
  em_revisao: 'Em revisão',
  aprovado: 'Aprovado',
  exportado: 'Exportado',
};

const STATUS_COLOR: Record<string, string> = {
  rascunho_ia: 'bg-amber-100 text-amber-700',
  em_revisao: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-teal-100 text-teal-700',
  exportado: 'bg-slate-100 text-slate-600',
};

export function DocumentosPage() {
  const [documentos, setDocumentos] = useState<DocumentoGerado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from('documentos_gerados')
      .select('*')
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        setDocumentos((data as DocumentoGerado[]) || []);
        setCarregando(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gerados a partir de transcrições. Para criar um novo, abra uma transcrição concluída e escolha um modelo.
          </p>
        </div>

        {carregando ? (
          <p className="text-slate-500 text-sm">Carregando...</p>
        ) : documentos.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum documento gerado ainda.</p>
              <Link to="/transcricoes" className="text-teal-600 text-sm font-medium hover:text-teal-700 mt-2 inline-block">
                Ir para transcrições
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {documentos.map((d) => (
              <Link key={d.id_documento} to={`/documentos/${d.id_documento}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{d.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d.criado_em))}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[d.status]}`}>
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
