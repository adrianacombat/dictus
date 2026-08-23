/*
# Parte 9 — Preços de provedores de IA (para monitorar custo por cliente)

## precos_provedores_ia
Tabela de referência com o preço cobrado por cada provedor de IA (AssemblyAI,
Anthropic etc.), por unidade (minuto de áudio, 1000 tokens de entrada, 1000
tokens de saída, por documento). O gestor mantém isso atualizado manualmente
quando o preço do provedor mudar; usado só para exibir estimativa de custo
no painel — não afeta cobrança do cliente.

Os valores da seed são uma ESTIMATIVA inicial (a mesma conta que já estava
embutida no código do ia-gateway para a AssemblyAI, e uma estimativa pública
para a Claude Sonnet) — o gestor deve conferir e corrigir com o valor real
do console de cada provedor.
*/

CREATE TABLE IF NOT EXISTS precos_provedores_ia (
  id_preco uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor varchar(60) NOT NULL,
  modelo varchar(80) NOT NULL,
  unidade varchar(30) NOT NULL CHECK (unidade IN ('por_minuto','por_1k_tokens_entrada','por_1k_tokens_saida','por_documento')),
  preco_usd numeric(10,6) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precos_provedores_ia_ativo ON precos_provedores_ia(ativo);

ALTER TABLE precos_provedores_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestor_select_precos_ia" ON precos_provedores_ia;
CREATE POLICY "gestor_select_precos_ia" ON precos_provedores_ia FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_insert_precos_ia" ON precos_provedores_ia;
CREATE POLICY "gestor_insert_precos_ia" ON precos_provedores_ia FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_precos_ia" ON precos_provedores_ia;
CREATE POLICY "gestor_update_precos_ia" ON precos_provedores_ia FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

INSERT INTO precos_provedores_ia (provedor, modelo, unidade, preco_usd)
SELECT * FROM (VALUES
  ('AssemblyAI', 'universal-2 + diarização', 'por_minuto', 0.0021),
  ('Anthropic', 'claude-sonnet-4-5 (entrada)', 'por_1k_tokens_entrada', 0.003),
  ('Anthropic', 'claude-sonnet-4-5 (saída)', 'por_1k_tokens_saida', 0.015)
) AS v(provedor, modelo, unidade, preco_usd)
WHERE NOT EXISTS (SELECT 1 FROM precos_provedores_ia WHERE provedor = v.provedor AND modelo = v.modelo);
