/*
# Notificações + Suporte (cliente relata problemas/sugestões ao gestor)

Perfil do usuário não precisa de tabela nova — usa as colunas que já existem
em `usuarios` (nome, profissao, registro_profissional) e a senha via
Supabase Auth. Só precisava da tela, que vem no próximo pacote de arquivos.

## notificacoes
Enviadas pelo gestor_plataforma, para todos, para uma conta específica, ou
para um usuário específico. Suporta corpo em HTML simples (formatação e
imagens via <img src="...">).

## notificacoes_leituras
Controla, por usuário, quais notificações já foram lidas — necessário porque
uma notificação "para todos" é uma linha só, mas cada usuário tem seu próprio
estado de leitura.

## suporte_tickets / suporte_mensagens
Canal de suporte: o cliente abre um ticket (bug, sugestão, dúvida) e conversa
em thread com o gestor da plataforma.
*/

-- ============================================================
-- 0. Correção de segurança: a política "update_own_usuario_login"
-- (auth.uid() = id_usuario) permite atualizar QUALQUER coluna da própria
-- linha, inclusive "papel" e "ativo" — ou seja, hoje um usuário comum
-- poderia se autopromover a gestor_plataforma direto pelo cliente. RLS não
-- restringe por coluna, então a trava certa é um trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION public.impedir_autopromocao_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.papel IS DISTINCT FROM OLD.papel OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Somente o gestor da plataforma pode alterar papel ou status ativo de um usuário.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_autopromocao_usuario ON usuarios;
CREATE TRIGGER trg_impedir_autopromocao_usuario
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.impedir_autopromocao_usuario();

-- ============================================================
-- notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id_notificacao uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo varchar(20) NOT NULL CHECK (escopo IN ('todos','conta','usuario')),
  id_conta uuid REFERENCES contas(id_conta) ON DELETE CASCADE,
  id_usuario_destino uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo varchar(200) NOT NULL,
  corpo_html text NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_escopo_consistente CHECK (
    (escopo = 'todos' AND id_conta IS NULL AND id_usuario_destino IS NULL) OR
    (escopo = 'conta' AND id_conta IS NOT NULL AND id_usuario_destino IS NULL) OR
    (escopo = 'usuario' AND id_usuario_destino IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_escopo ON notificacoes(escopo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_conta ON notificacoes(id_conta);

CREATE TABLE IF NOT EXISTS notificacoes_leituras (
  id_notificacao uuid NOT NULL REFERENCES notificacoes(id_notificacao) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_notificacao, id_usuario)
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_leituras ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado vê notificações destinadas a ele (todos / da própria
-- conta / dele especificamente); gestor_plataforma vê todas, para gerenciar.
DROP POLICY IF EXISTS "select_notificacoes_destinadas" ON notificacoes;
CREATE POLICY "select_notificacoes_destinadas" ON notificacoes FOR SELECT
  TO authenticated
  USING (
    escopo = 'todos'
    OR (escopo = 'conta' AND id_conta = public.get_my_conta_id())
    OR (escopo = 'usuario' AND id_usuario_destino = auth.uid())
    OR public.is_gestor_plataforma()
  );

DROP POLICY IF EXISTS "gestor_insert_notificacoes" ON notificacoes;
CREATE POLICY "gestor_insert_notificacoes" ON notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "select_own_leituras" ON notificacoes_leituras;
CREATE POLICY "select_own_leituras" ON notificacoes_leituras FOR SELECT
  TO authenticated
  USING (auth.uid() = id_usuario);

DROP POLICY IF EXISTS "insert_own_leituras" ON notificacoes_leituras;
CREATE POLICY "insert_own_leituras" ON notificacoes_leituras FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id_usuario);

-- ============================================================
-- suporte_tickets / suporte_mensagens
-- ============================================================
CREATE TABLE IF NOT EXISTS suporte_tickets (
  id_ticket uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta uuid NOT NULL REFERENCES contas(id_conta) ON DELETE CASCADE,
  id_usuario_criador uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo varchar(200) NOT NULL,
  tipo varchar(20) NOT NULL DEFAULT 'duvida' CHECK (tipo IN ('bug','sugestao','duvida')),
  status varchar(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_conta ON suporte_tickets(id_conta);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_status ON suporte_tickets(status);

CREATE TABLE IF NOT EXISTS suporte_mensagens (
  id_mensagem uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ticket uuid NOT NULL REFERENCES suporte_tickets(id_ticket) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suporte_mensagens_ticket ON suporte_mensagens(id_ticket);

ALTER TABLE suporte_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tickets_propria_conta_ou_gestor" ON suporte_tickets;
CREATE POLICY "select_tickets_propria_conta_ou_gestor" ON suporte_tickets FOR SELECT
  TO authenticated
  USING (id_conta = public.get_my_conta_id() OR public.is_gestor_plataforma());

DROP POLICY IF EXISTS "insert_ticket_propria_conta" ON suporte_tickets;
CREATE POLICY "insert_ticket_propria_conta" ON suporte_tickets FOR INSERT
  TO authenticated
  WITH CHECK (id_conta = public.get_my_conta_id() AND id_usuario_criador = auth.uid());

DROP POLICY IF EXISTS "update_ticket_propria_conta_ou_gestor" ON suporte_tickets;
CREATE POLICY "update_ticket_propria_conta_ou_gestor" ON suporte_tickets FOR UPDATE
  TO authenticated
  USING (id_conta = public.get_my_conta_id() OR public.is_gestor_plataforma())
  WITH CHECK (id_conta = public.get_my_conta_id() OR public.is_gestor_plataforma());

DROP POLICY IF EXISTS "select_mensagens_do_proprio_ticket_ou_gestor" ON suporte_mensagens;
CREATE POLICY "select_mensagens_do_proprio_ticket_ou_gestor" ON suporte_mensagens FOR SELECT
  TO authenticated
  USING (
    public.is_gestor_plataforma()
    OR EXISTS (SELECT 1 FROM suporte_tickets t WHERE t.id_ticket = suporte_mensagens.id_ticket AND t.id_conta = public.get_my_conta_id())
  );

DROP POLICY IF EXISTS "insert_mensagem_proprio_ticket_ou_gestor" ON suporte_mensagens;
CREATE POLICY "insert_mensagem_proprio_ticket_ou_gestor" ON suporte_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (
    id_usuario = auth.uid()
    AND (
      public.is_gestor_plataforma()
      OR EXISTS (SELECT 1 FROM suporte_tickets t WHERE t.id_ticket = suporte_mensagens.id_ticket AND t.id_conta = public.get_my_conta_id())
    )
  );
