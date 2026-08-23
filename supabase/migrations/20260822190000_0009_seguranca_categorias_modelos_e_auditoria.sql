/*
# Parte 7 — Correções de segurança encontradas na auditoria

## 1. categorias_documento / modelos_documento: vazamento entre contas
As políticas de SELECT criadas na 0008 eram `USING (true)` — ou seja,
QUALQUER usuário autenticado conseguia ler QUALQUER linha dessas tabelas,
inclusive categorias/modelos privados de outra conta (id_conta preenchido).
Hoje isso ainda não vazou nada porque só existem linhas globais
(id_conta IS NULL), mas o buraco fica pronto pra vazar no dia em que
alguém cadastrar um modelo específico de uma conta. Troca para: visível se
for global, da própria conta, ou se quem pergunta for o gestor.

## 2. chat: rótulo de origem errado no débito de crédito
A ação "chat" da ia-gateway debitava crédito de mensagens de IA usando
p_origem = 'consumo_documento' (copiado por engano do fluxo de documentos).
Isso não é falha de segurança, mas polui o relatório de consumo por
finalidade que vamos usar na Parte 9 (custo por IA/cliente). Corrige aqui
porque é uma linha só e já que estamos mexendo na área.

## 3. auditoria_gestor: log de ações administrativas
O gestor da plataforma tem poder amplo (aprovar/rejeitar compra, mudar
plano, ajustar crédito, ativar/desativar usuário, trocar papel, suspender
conta) e, até agora, nenhuma dessas ações ficava registrada em lugar
nenhum — se um gestor mudar o papel de alguém ou zerar o crédito de uma
conta, não há como saber depois quem fez o quê e quando. Adiciona uma
tabela de log e um trigger em "usuarios" para o caso mais sensível (troca
de papel/status). As funções administrativas (aprovar_compra etc.) já
existentes continuam funcionando sem alteração; o log de "usuarios" cobre
o ponto mais crítico agora. Novas ações administrativas that entrarem nas
próximas partes devem gravar aqui também.
*/

-- ============================================================
-- 1. categorias_documento / modelos_documento — SELECT com escopo certo
-- ============================================================
DROP POLICY IF EXISTS "select_categorias_documento_autenticado" ON categorias_documento;
CREATE POLICY "select_categorias_documento_escopo" ON categorias_documento FOR SELECT
  TO authenticated
  USING (
    id_conta IS NULL
    OR id_conta = public.get_my_conta_id()
    OR public.is_gestor_plataforma()
  );

DROP POLICY IF EXISTS "select_modelos_documento_autenticado" ON modelos_documento;
CREATE POLICY "select_modelos_documento_escopo" ON modelos_documento FOR SELECT
  TO authenticated
  USING (
    id_conta IS NULL
    OR id_conta = public.get_my_conta_id()
    OR public.is_gestor_plataforma()
  );

-- ============================================================
-- 2. auditoria_gestor — log de ações administrativas
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_gestor (
  id_log uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario_gestor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao varchar(60) NOT NULL,
  id_conta_afetada uuid REFERENCES contas(id_conta) ON DELETE SET NULL,
  id_usuario_afetado uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detalhes jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_gestor_criado_em ON auditoria_gestor(criado_em DESC);

ALTER TABLE auditoria_gestor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestor_select_auditoria" ON auditoria_gestor;
CREATE POLICY "gestor_select_auditoria" ON auditoria_gestor FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

-- Só a própria trigger/funções administrativas (SECURITY DEFINER, dono do
-- banco) inserem aqui — nenhuma policy de INSERT para "authenticated", de
-- propósito, pra ninguém conseguir forjar uma linha de auditoria direto.

-- ============================================================
-- 3. Trigger: registra troca de papel/ativo em usuarios
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_alteracao_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.papel IS DISTINCT FROM OLD.papel OR NEW.ativo IS DISTINCT FROM OLD.ativo) THEN
    INSERT INTO auditoria_gestor (id_usuario_gestor, acao, id_conta_afetada, id_usuario_afetado, detalhes)
    VALUES (
      auth.uid(),
      'alterar_usuario',
      NEW.id_conta,
      NEW.id_usuario,
      jsonb_build_object(
        'papel_antes', OLD.papel, 'papel_depois', NEW.papel,
        'ativo_antes', OLD.ativo, 'ativo_depois', NEW.ativo
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_alteracao_usuario ON usuarios;
CREATE TRIGGER trg_log_alteracao_usuario
  AFTER UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao_usuario();

-- ============================================================
-- 4. alterar_status_conta / gestor_alterar_plano / gestor_ajustar_credito:
-- passam a registrar também em auditoria_gestor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.alterar_status_conta(p_id_conta uuid, p_novo_status varchar)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Apenas o gestor da plataforma pode alterar o status de uma conta.';
  END IF;

  IF p_novo_status NOT IN ('trial','ativo','suspenso','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', p_novo_status;
  END IF;

  UPDATE contas SET status = p_novo_status WHERE id_conta = p_id_conta;

  INSERT INTO auditoria_gestor (id_usuario_gestor, acao, id_conta_afetada, detalhes)
  VALUES (auth.uid(), 'alterar_status_conta', p_id_conta, jsonb_build_object('novo_status', p_novo_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.gestor_alterar_plano(p_id_conta uuid, p_id_plano uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Apenas o gestor da plataforma pode alterar o plano de uma conta.';
  END IF;

  UPDATE contas SET id_plano = p_id_plano WHERE id_conta = p_id_conta;

  INSERT INTO auditoria_gestor (id_usuario_gestor, acao, id_conta_afetada, detalhes)
  VALUES (auth.uid(), 'alterar_plano', p_id_conta, jsonb_build_object('novo_plano', p_id_plano));
END;
$$;

CREATE OR REPLACE FUNCTION public.gestor_ajustar_credito(
  p_id_conta uuid,
  p_tipo varchar,
  p_quantidade numeric,
  p_motivo varchar DEFAULT 'ajuste_manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Apenas o gestor da plataforma pode ajustar créditos.';
  END IF;

  IF p_tipo NOT IN ('minutos','documentos','documentos_tecnicos','mensagens_ia') THEN
    RAISE EXCEPTION 'Tipo de crédito inválido: %', p_tipo;
  END IF;

  PERFORM creditar_saldo(p_id_conta, p_tipo, p_quantidade, 'ajuste_manual', NULL);

  INSERT INTO auditoria_gestor (id_usuario_gestor, acao, id_conta_afetada, detalhes)
  VALUES (auth.uid(), 'ajustar_credito', p_id_conta, jsonb_build_object('tipo', p_tipo, 'quantidade', p_quantidade, 'motivo', p_motivo));
END;
$$;
