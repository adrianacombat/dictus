/*
# Correção: contas novas sem saldo de crédito + gestão de créditos/planos pelo gestor

## Bug corrigido
O saldo inicial de créditos (credito_saldo) só era populado uma vez, via um
INSERT manual de backfill, na migration de créditos. Toda conta criada DEPOIS
daquele momento (ex.: admin@falari.test) nunca ganhou linha em credito_saldo,
então qualquer ação de IA falhava com "créditos esgotados" mesmo em contas
novas no trial. Este arquivo:
  1. Faz o handle_new_user() já criar o saldo inicial (créditos do plano) no
     momento do cadastro, para todo cadastro futuro.
  2. Faz o backfill das contas que já existem e ainda não têm credito_saldo.

## Gestão pelo Painel do Gestor
Adiciona duas funções administrativas (idem ao padrão já usado em
aprovar_compra/rejeitar_compra: cada uma valida internamente que quem chama é
gestor_plataforma, por isso podem ficar liberadas para "authenticated"):
  - gestor_ajustar_credito: soma/subtrai créditos de qualquer tipo, em
    qualquer conta, registrando o motivo no histórico.
  - gestor_alterar_plano: troca o plano de uma conta.
*/

-- ============================================================
-- 1. handle_new_user() agora também cria o saldo inicial de créditos
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_conta uuid;
  v_id_plano uuid;
  v_segmento text;
  v_nome text;
  v_profissao text;
  v_registro text;
  v_plano RECORD;
BEGIN
  v_segmento := NEW.raw_user_meta_data->>'segmento_uso';
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  v_profissao := NEW.raw_user_meta_data->>'profissao';
  v_registro := NEW.raw_user_meta_data->>'registro_profissional';

  SELECT * INTO v_plano FROM planos WHERE ativo = true ORDER BY ordem LIMIT 1;
  v_id_plano := v_plano.id_plano;

  INSERT INTO contas (tipo_conta, nome, email_principal, segmento_uso, id_plano, status, trial_inicio, trial_fim)
  VALUES (
    'individual',
    v_nome,
    NEW.email,
    COALESCE(v_segmento, 'outro'),
    v_id_plano,
    'trial',
    now(),
    now() + interval '7 days'
  )
  RETURNING id_conta INTO v_id_conta;

  INSERT INTO usuarios (id_usuario, id_conta, nome, email, papel, profissao, registro_profissional, mfa_ativo, ativo)
  VALUES (
    NEW.id,
    v_id_conta,
    v_nome,
    NEW.email,
    'owner',
    NULLIF(v_profissao, ''),
    NULLIF(v_registro, ''),
    false,
    true
  );

  -- Saldo inicial de créditos, a partir dos limites do plano atribuído
  INSERT INTO credito_saldo (id_conta, minutos_disponiveis, documentos_disponiveis, documentos_tecnicos_disponiveis, mensagens_ia_disponiveis, mes_referencia)
  VALUES (
    v_id_conta,
    COALESCE(v_plano.limite_minutos_transcricao, 0),
    COALESCE(v_plano.limite_documentos, 0),
    COALESCE(v_plano.limite_documentos_tecnicos, 0),
    COALESCE(v_plano.limite_mensagens_ia, 0),
    to_char(now(), 'YYYY-MM')
  )
  ON CONFLICT (id_conta) DO NOTHING;

  INSERT INTO credito_movimentos (id_conta, tipo, quantidade, origem)
  SELECT v_id_conta, tipo, quantidade, 'plano_mensal' FROM (
    VALUES
      ('minutos', COALESCE(v_plano.limite_minutos_transcricao, 0)),
      ('documentos', COALESCE(v_plano.limite_documentos, 0)),
      ('documentos_tecnicos', COALESCE(v_plano.limite_documentos_tecnicos, 0)),
      ('mensagens_ia', COALESCE(v_plano.limite_mensagens_ia, 0))
  ) AS t(tipo, quantidade)
  WHERE quantidade > 0;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Backfill das contas já existentes sem credito_saldo
-- ============================================================
INSERT INTO credito_saldo (id_conta, minutos_disponiveis, documentos_disponiveis, documentos_tecnicos_disponiveis, mensagens_ia_disponiveis, mes_referencia)
SELECT c.id_conta, p.limite_minutos_transcricao, p.limite_documentos, p.limite_documentos_tecnicos, p.limite_mensagens_ia, to_char(now(), 'YYYY-MM')
FROM contas c
JOIN planos p ON c.id_plano = p.id_plano
WHERE NOT EXISTS (SELECT 1 FROM credito_saldo s WHERE s.id_conta = c.id_conta)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Funções administrativas do Painel do Gestor
-- ============================================================
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestor_ajustar_credito(uuid, varchar, numeric, varchar) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gestor_ajustar_credito(uuid, varchar, numeric, varchar) FROM anon;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestor_alterar_plano(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gestor_alterar_plano(uuid, uuid) FROM anon;

-- planos precisa ser visível para o gestor escolher (já é: select_planos permite leitura
-- para qualquer authenticated). credito_movimentos de todas as contas: gestor também
-- precisa enxergar, para auditoria/consumo agregado.
DROP POLICY IF EXISTS "gestor_select_todos_movimentos" ON credito_movimentos;
CREATE POLICY "gestor_select_todos_movimentos" ON credito_movimentos FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());
