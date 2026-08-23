export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatSegmentoLabel(segmento: string): string {
  const labels: Record<string, string> = {
    juridico: 'Jurídico',
    empresarial: 'Empresarial',
    academico: 'Acadêmico',
    saude: 'Saúde',
    jornalismo: 'Jornalismo',
    pessoal: 'Pessoal',
    outro: 'Outro',
  };
  return labels[segmento] || segmento;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function daysUntil(date: string | null): number {
  if (!date) return 0;
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
