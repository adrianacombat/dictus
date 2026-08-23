/*
# Painel do Gestor da Plataforma — Fase 6

Dá ao papel 'gestor_plataforma' visão de todas as contas (multi-tenant) e
ações administrativas (aprovar/rejeitar compras de crédito, suspender/
reativar contas), sem abrir essas operações para usuários comuns.
*/

-- ============================================================
-- Helper: é gestor da plataforma? (SECURITY DEFINER evita recursão de RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_gestor_plataforma()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE id_usuario = auth.uid() AND papel = 'gestor_plataforma'
  );
$$;

REVOKE ALL ON FUNCTION public.is_gestor_plataforma() FROM public;
GRANT EXECUTE ON FUNCTION public.is_gestor_plataforma() TO authenticated;

-- ============================================================
-- RLS extra: gestor_plataforma enxerga todas as contas
-- ============================================================
DROP POLICY IF EXISTS "gestor_select_todas_contas" ON contas;
CREATE POLICY "gestor_select_todas_contas" ON contas FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_update_todas_contas" ON contas;
CREATE POLICY "gestor_update_todas_contas" ON contas FOR UPDATE
  TO authenticated
  USING (public.is_gestor_plataforma())
  WITH CHECK (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_select_todos_usuarios" ON usuarios;
CREATE POLICY "gestor_select_todos_usuarios" ON usuarios FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_select_todas_compras" ON compras_creditos;
CREATE POLICY "gestor_select_todas_compras" ON compras_creditos FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_select_todos_saldos" ON credito_saldo;
CREATE POLICY "gestor_select_todos_saldos" ON credito_saldo FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

DROP POLICY IF EXISTS "gestor_select_todo_consumo" ON consumo_ia_log;
CREATE POLICY "gestor_select_todo_consumo" ON consumo_ia_log FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());

-- ============================================================
-- Funções administrativas — cada uma valida internamente que quem chama
-- é gestor_plataforma antes de agir, por isso podem ser expostas para
-- "authenticated" com segurança (usuários comuns recebem exceção).
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprovar_compra(p_id_compra uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
BEGIN
  IF NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Apenas o gestor da plataforma pode aprovar compras.';
  END IF;

  SELECT * INTO v_compra FROM compras_creditos WHERE id_compra = p_id_compra AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada ou não está pendente.';
  END IF;

  UPDATE compras_creditos
  SET status = 'aprovado', respondido_em = now(), respondido_por = auth.uid()
  WHERE id_compra = p_id_compra;

  PERFORM creditar_saldo(
    v_compra.id_conta,
    (SELECT tipo FROM pacotes_creditos WHERE id_pacote = v_compra.id_pacote),
    (SELECT quantidade FROM pacotes_creditos WHERE id_pacote = v_compra.id_pacote),
    'pacote_avulso',
    p_id_compra
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_compra(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.aprovar_compra(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.rejeitar_compra(p_id_compra uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gestor_plataforma() THEN
    RAISE EXCEPTION 'Apenas o gestor da plataforma pode rejeitar compras.';
  END IF;

  UPDATE compras_creditos
  SET status = 'rejeitado', respondido_em = now(), respondido_por = auth.uid()
  WHERE id_compra = p_id_compra AND status = 'pendente';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rejeitar_compra(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rejeitar_compra(uuid) FROM anon;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.alterar_status_conta(uuid, varchar) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.alterar_status_conta(uuid, varchar) FROM anon;
