import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ShieldAlert } from 'lucide-react';

interface LogAuditoria {
  id_log: string;
  id_usuario_gestor: string | null;
  acao: string;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
  contas?: { nome: string } | null;
}

const ACAO_LABEL: Record<string, string> = {
  alterar_usuario: 'Alterou usuário (papel/status)',
  alterar_status_conta: 'Alterou status da conta',
  alterar_plano: 'Alterou plano da conta',
  ajustar_credito: 'Ajustou crédito manualmente',
};

function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(data));
}

export function AbaAuditoria() {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [nomesGestores, setNomesGestores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('auditoria_gestor')
        .select('*, contas(nome)')
        .order('criado_em', { ascending: false })
        .limit(100);
      const lista = (data as LogAuditoria[]) || [];
      setLogs(lista);

      const idsGestores = [...new Set(lista.map((l) => l.id_usuario_gestor).filter(Boolean))] as string[];
      if (idsGestores.length > 0) {
        const { data: usuarios } = await supabase
          .from('usuarios')
          .select('id_usuario, nome')
          .in('id_usuario', idsGestores);
        setNomesGestores(Object.fromEntries((usuarios || []).map((u) => [u.id_usuario, u.nome])));
      }

      setCarregando(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Auditoria de ações administrativas
        </CardTitle>
        <CardDescription>
          Últimas 100 ações sensíveis feitas por gestores da plataforma: troca de papel/status de
          usuário, alteração de plano, ajuste manual de crédito, mudança de status de conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ação registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Gestor</th>
                  <th className="py-2 pr-3 font-medium">Ação</th>
                  <th className="py-2 pr-3 font-medium">Conta afetada</th>
                  <th className="py-2 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id_log} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{formatarDataHora(log.criado_em)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                      {(log.id_usuario_gestor && nomesGestores[log.id_usuario_gestor]) || '—'}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{ACAO_LABEL[log.acao] || log.acao}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{log.contas?.nome || '—'}</td>
                    <td className="py-2 text-slate-500 text-xs">
                      {log.detalhes ? JSON.stringify(log.detalhes) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
