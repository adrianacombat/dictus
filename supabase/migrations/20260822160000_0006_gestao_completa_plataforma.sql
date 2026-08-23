/*
# Gestão completa da plataforma pelo gestor_plataforma

Adiciona ao gestor_plataforma:
  - Gerenciar planos (criar/editar/desativar), direto por RLS (INSERT/UPDATE).
  - Gerenciar pacotes de crédito avulso, direto por RLS (INSERT/UPDATE).
  - Gerenciar usuários de qualquer conta (ativar/desativar, trocar papel).
  - Visibilidade de transcricoes/documentos_gerados de todas as contas, para
    o painel de consumo agregado da plataforma.

Segue o mesmo padrão já usado no resto do projeto: planos e pacotes são
tabelas de referência simples, então usamos RLS direto (sem função
intermediária) — mais simples e igualmente seguro, já que a própria
política já checa is_gestor_plataforma().
*/

-- ============================================================
-- Planos: gestor pode inserir/editar
-- ============================================================
DROP POLICY IF EXISTS "gestor_insert_planos" ON planos;
CREATE POLICY "gestor_insert_planos" ON planos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_planos" ON planos;
CREATE POLICY "gestor_update_planos" ON planos FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

-- ============================================================
-- Pacotes de crédito: gestor pode inserir/editar
-- ============================================================
DROP POLICY IF EXISTS "gestor_insert_pacotes" ON pacotes_creditos;
CREATE POLICY "gestor_insert_pacotes" ON pacotes_creditos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_pacotes" ON pacotes_creditos;
CREATE POLICY "gestor_update_pacotes" ON pacotes_creditos FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

-- ============================================================
-- Usuários: gestor pode ver e editar usuários de QUALQUER conta
-- (ativar/desativar, trocar papel — inclusive promover a gestor_plataforma,
-- o que é seguro aqui porque só quem JÁ é gestor consegue chamar isto; o
-- formulário público de cadastro continua sem oferecer essa opção).
-- ============================================================
DROP POLICY IF EXISTS "gestor_update_qualquer_usuario" ON usuarios;
CREATE POLICY "gestor_update_qualquer_usuario" ON usuarios FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

-- ============================================================
-- Consumo agregado: gestor enxerga transcrições e documentos de todas as
-- contas (somente leitura, para estatísticas — não edita conteúdo alheio).
-- ============================================================
DROP POLICY IF EXISTS "gestor_select_todas_transcricoes" ON transcricoes;
CREATE POLICY "gestor_select_todas_transcricoes" ON transcricoes FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_select_todos_documentos" ON documentos_gerados;
CREATE POLICY "gestor_select_todos_documentos" ON documentos_gerados FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());
