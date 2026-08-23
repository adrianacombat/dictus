/*
# Transcrição formatada + Relatório Técnico Jurídico + gestão de prompts de IA

## O que já existia
- transcricao_segmentos já guarda inicio_ms/fim_ms/texto por trecho, ligado a
  transcricao_interlocutores (rotulo_original, nome_atribuido) — os dados de
  quem falou e quando já são gravados pela AssemblyAI (speaker_labels), só não
  eram exibidos na tela.
- hash_arquivo_sha256 já é calculado no navegador e gravado em transcricoes.
- prompts_ia já existe e já é usado por gerar_documento (Edge Function) para
  buscar as instruções de IA por tipo_saida.
- categorias_documento já tem uma coluna "segmento".

## O que este arquivo adiciona
1. RLS de leitura/edição em transcricao_segmentos e transcricao_interlocutores
   (a conta dona da transcrição pode ler os segmentos e renomear interlocutores).
2. RLS para o gestor_plataforma gerenciar prompts_ia, categorias_documento e
   modelos_documento (hoje só a Edge Function, com service role, mexe nelas).
3. Uma nova categoria + modelo "Relatório Técnico de Transcrição", com
   segmento = 'juridico' — só aparece para contas desse segmento.
4. Um prompt de IA dedicado para esse tipo de documento, com instruções de
   formatação (objeto, metodologia, convenções de transcrição, qualificação
   dos interlocutores, transcrição integral com marcações de tempo,
   encerramento) e o aviso de que não é laudo pericial judicial.
*/

-- ============================================================
-- 1. RLS: transcricao_segmentos / transcricao_interlocutores
-- ============================================================
ALTER TABLE transcricao_segmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcricao_interlocutores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_segmentos_propria_conta" ON transcricao_segmentos;
CREATE POLICY "select_segmentos_propria_conta" ON transcricao_segmentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transcricoes t
      WHERE t.id_transcricao = transcricao_segmentos.id_transcricao
        AND t.id_conta = public.get_my_conta_id()
    )
  );

DROP POLICY IF EXISTS "select_interlocutores_propria_conta" ON transcricao_interlocutores;
CREATE POLICY "select_interlocutores_propria_conta" ON transcricao_interlocutores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transcricoes t
      WHERE t.id_transcricao = transcricao_interlocutores.id_transcricao
        AND t.id_conta = public.get_my_conta_id()
    )
  );

DROP POLICY IF EXISTS "update_interlocutores_propria_conta" ON transcricao_interlocutores;
CREATE POLICY "update_interlocutores_propria_conta" ON transcricao_interlocutores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transcricoes t
      WHERE t.id_transcricao = transcricao_interlocutores.id_transcricao
        AND t.id_conta = public.get_my_conta_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transcricoes t
      WHERE t.id_transcricao = transcricao_interlocutores.id_transcricao
        AND t.id_conta = public.get_my_conta_id()
    )
  );

-- ============================================================
-- 2. RLS: gestor_plataforma gerencia prompts_ia, categorias e modelos
-- ============================================================

-- Defensivo: garante que a tabela existe com as colunas usadas pelo
-- ia-gateway e pela nova tela do gestor, sem alterar nada se já existir.
CREATE TABLE IF NOT EXISTS prompts_ia (
  id_prompt uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_saida varchar(60) NOT NULL,
  texto_prompt text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prompts_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_documento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_prompts_ia_autenticado" ON prompts_ia;
CREATE POLICY "select_prompts_ia_autenticado" ON prompts_ia FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_insert_prompts_ia" ON prompts_ia;
CREATE POLICY "gestor_insert_prompts_ia" ON prompts_ia FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_prompts_ia" ON prompts_ia;
CREATE POLICY "gestor_update_prompts_ia" ON prompts_ia FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "select_categorias_documento_autenticado" ON categorias_documento;
CREATE POLICY "select_categorias_documento_autenticado" ON categorias_documento FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "gestor_insert_categorias_documento" ON categorias_documento;
CREATE POLICY "gestor_insert_categorias_documento" ON categorias_documento FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "select_modelos_documento_autenticado" ON modelos_documento;
CREATE POLICY "select_modelos_documento_autenticado" ON modelos_documento FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "gestor_insert_modelos_documento" ON modelos_documento;
CREATE POLICY "gestor_insert_modelos_documento" ON modelos_documento FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_modelos_documento" ON modelos_documento;
CREATE POLICY "gestor_update_modelos_documento" ON modelos_documento FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

-- ============================================================
-- 3. Categoria + modelo "Relatório Técnico de Transcrição" (jurídico)
-- ============================================================
INSERT INTO categorias_documento (id_conta, nome, segmento)
SELECT NULL, 'Relatório Técnico de Transcrição', 'juridico'
WHERE NOT EXISTS (
  SELECT 1 FROM categorias_documento WHERE nome = 'Relatório Técnico de Transcrição' AND segmento = 'juridico'
);

INSERT INTO modelos_documento (id_conta, id_categoria, tipo_saida, descricao, conteudo_html, variaveis_disponiveis, ativo)
SELECT
  NULL,
  c.id_categoria,
  'relatorio_tecnico_transcricao',
  'Relatório Técnico de Transcrição',
  '<h1>Relatório Técnico de Transcrição</h1>' ||
  '<p><strong>Data do relatório:</strong> {{data_hoje}}</p>' ||
  '<p><strong>Participantes informados:</strong> {{participantes}}</p>' ||
  '<h2>1. Objeto</h2><p>{{transcricao.texto}}</p>' ||
  '<h2>2. Metodologia</h2><p>Transcrição realizada por sistema de reconhecimento automático de fala, com identificação de interlocutores e marcação de tempo por trecho. Sujeita a revisão humana.</p>' ||
  '<h2>3. Convenções de transcrição</h2><p>Trechos inaudíveis, sobreposição de falas e hesitações são sinalizados quando identificados pelo sistema. A pontuação é inserida automaticamente e pode não refletir integralmente a entonação original.</p>' ||
  '<h2>4. Cadeia de custódia</h2><p><strong>Hash SHA-256 do arquivo original:</strong> {{hash_arquivo}}<br/><strong>Origem da captura:</strong> {{origem_captura}}<br/><strong>Data da transcrição:</strong> {{data_transcricao}}</p>' ||
  '<h2>5. Encerramento</h2><p>Este é um documento técnico produzido por inteligência artificial, não substituindo laudo pericial judicial quando este for exigido por lei ou determinação judicial. Recomenda-se revisão humana antes de qualquer uso oficial.</p>',
  '["transcricao.texto","participantes","data_hoje","hash_arquivo","origem_captura","data_transcricao"]'::jsonb,
  true
FROM categorias_documento c
WHERE c.nome = 'Relatório Técnico de Transcrição' AND c.segmento = 'juridico'
AND NOT EXISTS (SELECT 1 FROM modelos_documento WHERE tipo_saida = 'relatorio_tecnico_transcricao');

-- ============================================================
-- 4. Prompt de IA para esse tipo de documento
-- ============================================================
INSERT INTO prompts_ia (tipo_saida, texto_prompt, versao, ativo)
SELECT
  'relatorio_tecnico_transcricao',
  'Gere o corpo de um Relatório Técnico de Transcrição a partir do texto a seguir. ' ||
  'Organize em: objeto (resumo do que foi transcrito), metodologia (como a transcrição foi feita), ' ||
  'identificação e qualificação dos interlocutores (pelos nomes informados quando disponíveis), ' ||
  'transcrição integral organizada por interlocutor, e observações finais. ' ||
  'Use HTML simples (<h2>, <p>, <ul>). Nunca use o termo "laudo pericial" — este é um documento técnico ' ||
  'de apoio, não uma perícia judicial com fé pública. Texto da transcrição: {{transcricao.texto}}. ' ||
  'Participantes informados: {{participantes}}.',
  1,
  true
WHERE NOT EXISTS (SELECT 1 FROM prompts_ia WHERE tipo_saida = 'relatorio_tecnico_transcricao');
