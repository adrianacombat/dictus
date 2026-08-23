/*
# Parte 13 — Base para pagamentos (Stripe) + bloqueio automático pós-trial

## O que este arquivo faz agora (não depende de chave nenhuma)
1. Adiciona campos em "contas" para guardar a ligação com o Stripe
   (stripe_customer_id, stripe_subscription_id) e a forma de pagamento.
2. Cria eventos_stripe, tabela de controle pra quando o webhook do Stripe
   for implementado (evita processar o mesmo evento duas vezes).
3. handle_new_user() passa a aceitar um "plano_escolhido" (id_plano) vindo do
   cadastro — se o usuário escolher um plano na tela de signup, a conta já
   nasce vinculada a ele (o período de trial continua existindo do mesmo
   jeito, só muda pra qual plano ela vai quando o trial acabar).

## O que ainda NÃO faz (depende das chaves do Stripe, que só você tem)
Checkout de verdade, cobrança, webhook de confirmação de pagamento — isso
entra numa migration futura, assim que você tiver a API key do Stripe (modo
teste primeiro) e eu conseguir implementar e você testar de verdade.
*/

ALTER TABLE contas ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS forma_pagamento varchar(20) NOT NULL DEFAULT 'nenhuma'
  CHECK (forma_pagamento IN ('nenhuma','stripe'));

CREATE TABLE IF NOT EXISTS eventos_stripe (
  id_evento_stripe text PRIMARY KEY,
  tipo varchar(80) NOT NULL,
  processado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eventos_stripe ENABLE ROW LEVEL SECURITY;
-- Sem política de SELECT/INSERT para "authenticated" de propósito: só a
-- Edge Function do webhook (service role, que ignora RLS) mexe aqui.

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
  v_plano_escolhido_id uuid;
BEGIN
  v_segmento := NEW.raw_user_meta_data->>'segmento_uso';
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  v_profissao := NEW.raw_user_meta_data->>'profissao';
  v_registro := NEW.raw_user_meta_data->>'registro_profissional';

  -- Se o cadastro veio com um plano escolhido válido e ativo, usa ele.
  -- Senão, cai no comportamento de sempre (primeiro plano ativo por ordem).
  BEGIN
    v_plano_escolhido_id := NULLIF(NEW.raw_user_meta_data->>'plano_escolhido', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_plano_escolhido_id := NULL;
  END;

  IF v_plano_escolhido_id IS NOT NULL THEN
    SELECT * INTO v_plano FROM planos WHERE id_plano = v_plano_escolhido_id AND ativo = true;
  END IF;

  IF v_plano_escolhido_id IS NULL OR NOT FOUND THEN
    SELECT * INTO v_plano FROM planos WHERE ativo = true ORDER BY ordem LIMIT 1;
  END IF;

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
