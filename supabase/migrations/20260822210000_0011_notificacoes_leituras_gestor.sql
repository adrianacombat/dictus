/*
# Parte 10 — Gestor precisa ler notificacoes_leituras de todo mundo

A aba de Notificações do gestor agora mostra quantas pessoas já leram cada
notificação enviada. Isso exige ler notificacoes_leituras de QUALQUER
usuário (hoje a política só deixa cada um ver a própria leitura). Adiciona
uma política extra só de SELECT para gestor_plataforma — não abre
INSERT/UPDATE/DELETE de leitura alheia, só a contagem.
*/

DROP POLICY IF EXISTS "gestor_select_todas_leituras" ON notificacoes_leituras;
CREATE POLICY "gestor_select_todas_leituras" ON notificacoes_leituras FOR SELECT
  TO authenticated
  USING (public.is_gestor_plataforma());
