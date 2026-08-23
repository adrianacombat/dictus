/*
# Foundation Schema — Phase 0

## Purpose
Creates the core database foundation for a multi-tenant SaaS platform for
AI-powered audio/video transcription and automatic document generation.

## New Tables

1. **planos** — Subscription plans (global reference data)
   - id_plano (uuid PK), nome, preco_mensal, preco_anual,
     limite_minutos_transcricao, limite_documentos, limite_documentos_tecnicos,
     limite_mensagens_ia, limite_membros, ativo, ordem

2. **contas** — Tenant accounts (one per organization/individual)
   - id_conta (uuid PK), tipo_conta (individual|equipe), nome, email_principal (unique),
     segmento_uso, id_plano (FK), status (trial|ativo|suspenso|cancelado),
     trial_inicio, trial_fim, criado_em, atualizado_em

3. **usuarios** — Application users linked to Supabase Auth
   - id_usuario (uuid PK = auth.users.id, FK), id_conta (FK), nome, email (unique),
     papel (owner|membro|gestor_plataforma), profissao, registro_profissional,
     mfa_ativo, ativo, ultimo_login, criado_em

4. **assinaturas** — Subscription records linking contas to planos
   - id_assinatura (uuid PK), id_conta (FK), id_plano (FK),
     periodicidade (mensal|anual), status, data_inicio, data_proxima_cobranca, criado_em

## Security
- RLS enabled on all four tables.
- planos: read-only for all authenticated users (global reference).
- contas/usuarios/assinaturas: scoped to the user's own conta via usuarios link.

## Automation
- SECURITY DEFINER trigger function handle_new_user() fires AFTER INSERT on
  auth.users. Automatically creates:
  1. A conta (account) with status='trial', trial_inicio=now(), trial_fim=now()+7days
  2. A usuario record linking auth.users.id to the new conta with papel='owner'
- update_contas_atualizado_em() trigger auto-updates atualizado_em on contas UPDATE.

## Seed Data
- Inserts a default "Trial" plan (free, with trial limits) and a "Profissional" plan.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- planos
-- ============================================================
CREATE TABLE IF NOT EXISTS planos (
  id_plano uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(120) NOT NULL,
  preco_mensal numeric(10,2) NOT NULL DEFAULT 0,
  preco_anual numeric(10,2) NOT NULL DEFAULT 0,
  limite_minutos_transcricao int NOT NULL DEFAULT 0,
  limite_documentos int NOT NULL DEFAULT 0,
  limite_documentos_tecnicos int NOT NULL DEFAULT 0,
  limite_mensagens_ia int NOT NULL DEFAULT 0,
  limite_membros int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);

-- ============================================================
-- contas
-- ============================================================
CREATE TABLE IF NOT EXISTS contas (
  id_conta uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_conta varchar(20) NOT NULL DEFAULT 'individual' CHECK (tipo_conta IN ('individual','equipe')),
  nome varchar(200) NOT NULL,
  email_principal varchar(255) NOT NULL UNIQUE,
  segmento_uso varchar(30) NOT NULL DEFAULT 'outro' CHECK (segmento_uso IN ('juridico','empresarial','academico','saude','jornalismo','pessoal','outro')),
  id_plano uuid REFERENCES planos(id_plano),
  status varchar(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','ativo','suspenso','cancelado')),
  trial_inicio timestamptz NOT NULL DEFAULT now(),
  trial_fim timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_status ON contas(status);
CREATE INDEX IF NOT EXISTS idx_contas_email_principal ON contas(email_principal);

-- ============================================================
-- usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  id_conta uuid NOT NULL REFERENCES contas(id_conta) ON DELETE CASCADE,
  nome varchar(200) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  papel varchar(30) NOT NULL DEFAULT 'membro' CHECK (papel IN ('owner','membro','gestor_plataforma')),
  profissao varchar(200),
  registro_profissional varchar(200),
  mfa_ativo boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_login timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_id_conta ON usuarios(id_conta);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ============================================================
-- assinaturas
-- ============================================================
CREATE TABLE IF NOT EXISTS assinaturas (
  id_assinatura uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta uuid NOT NULL REFERENCES contas(id_conta) ON DELETE CASCADE,
  id_plano uuid NOT NULL REFERENCES planos(id_plano),
  periodicidade varchar(10) NOT NULL DEFAULT 'mensal' CHECK (periodicidade IN ('mensal','anual')),
  status varchar(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada','expirada','suspensa')),
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_proxima_cobranca timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_id_conta ON assinaturas(id_conta);

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- planos: global read
DROP POLICY IF EXISTS "select_planos" ON planos;
CREATE POLICY "select_planos" ON planos FOR SELECT
  TO authenticated USING (true);

-- contas: scoped via usuarios
DROP POLICY IF EXISTS "select_own_conta" ON contas;
CREATE POLICY "select_own_conta" ON contas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = contas.id_conta));

DROP POLICY IF EXISTS "update_own_conta" ON contas;
CREATE POLICY "update_own_conta" ON contas FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = contas.id_conta))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = contas.id_conta));

-- usuarios: scoped by conta membership
DROP POLICY IF EXISTS "select_own_conta_usuarios" ON usuarios;
CREATE POLICY "select_own_conta_usuarios" ON usuarios FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = usuarios.id_conta));

DROP POLICY IF EXISTS "insert_own_conta_usuarios" ON usuarios;
CREATE POLICY "insert_own_conta_usuarios" ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = usuarios.id_conta));

DROP POLICY IF EXISTS "update_own_conta_usuarios" ON usuarios;
CREATE POLICY "update_own_conta_usuarios" ON usuarios FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = usuarios.id_conta))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = usuarios.id_conta));

DROP POLICY IF EXISTS "delete_own_conta_usuarios" ON usuarios;
CREATE POLICY "delete_own_conta_usuarios" ON usuarios FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = usuarios.id_conta));

DROP POLICY IF EXISTS "update_own_usuario_login" ON usuarios;
CREATE POLICY "update_own_usuario_login" ON usuarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = id_usuario)
  WITH CHECK (auth.uid() = id_usuario);

-- assinaturas: scoped by conta membership
DROP POLICY IF EXISTS "select_own_assinatura" ON assinaturas;
CREATE POLICY "select_own_assinatura" ON assinaturas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = assinaturas.id_conta));

DROP POLICY IF EXISTS "insert_own_assinatura" ON assinaturas;
CREATE POLICY "insert_own_assinatura" ON assinaturas FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = assinaturas.id_conta));

DROP POLICY IF EXISTS "update_own_assinatura" ON assinaturas;
CREATE POLICY "update_own_assinatura" ON assinaturas FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = assinaturas.id_conta))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id_usuario = auth.uid() AND u.id_conta = assinaturas.id_conta));

-- ============================================================
-- Helper: auto-update atualizado_em on contas
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_contas_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contas_atualizado_em ON contas;
CREATE TRIGGER trg_contas_atualizado_em
  BEFORE UPDATE ON contas
  FOR EACH ROW EXECUTE FUNCTION public.update_contas_atualizado_em();

-- ============================================================
-- Auth Trigger: auto-create conta + usuario on signup
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
BEGIN
  v_segmento := NEW.raw_user_meta_data->>'segmento_uso';
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  v_profissao := NEW.raw_user_meta_data->>'profissao';
  v_registro := NEW.raw_user_meta_data->>'registro_profissional';

  SELECT id_plano INTO v_id_plano FROM planos WHERE ativo = true ORDER BY ordem LIMIT 1;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Seed: default plans
-- ============================================================
INSERT INTO planos (nome, preco_mensal, preco_anual, limite_minutos_transcricao, limite_documentos, limite_documentos_tecnicos, limite_mensagens_ia, limite_membros, ativo, ordem)
VALUES
  ('Trial', 0, 0, 120, 5, 1, 20, 1, true, 0),
  ('Profissional', 149.90, 1499.00, 600, 50, 10, 500, 5, true, 1)
ON CONFLICT DO NOTHING;
