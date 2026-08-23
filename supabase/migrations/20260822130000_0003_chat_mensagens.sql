/*
# Assistente IA — histórico de chat

Também garante (idempotente) a função get_my_conta_id(), criada anteriormente
via SQL Editor para corrigir a recursão infinita de RLS em "usuarios" — fica
registrada aqui na migration para o histórico do projeto ficar consistente
com o estado real do banco.
*/

CREATE OR REPLACE FUNCTION public.get_my_conta_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_conta FROM usuarios WHERE id_usuario = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_conta_id() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_conta_id() TO authenticated;

CREATE TABLE IF NOT EXISTS chat_mensagens (
  id_mensagem uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_conta uuid NOT NULL REFERENCES contas(id_conta) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel varchar(10) NOT NULL CHECK (papel IN ('user','assistant')),
  conteudo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_id_conta ON chat_mensagens(id_conta);

ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_mensagens" ON chat_mensagens;
CREATE POLICY "select_own_chat_mensagens" ON chat_mensagens FOR SELECT
  TO authenticated
  USING (id_conta = public.get_my_conta_id());

-- Inserção só acontece via Edge Function (service role), nunca direto do cliente.
