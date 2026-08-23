/*
# Parte 11 — Instruções de IA: qual modelo cada instrução usa

Adiciona a coluna modelo_ia em prompts_ia, pra saber qual IA/modelo cada
instrução foi escrita para (ex.: claude-sonnet-4-5, assemblyai-universal-2).
Só informativo por enquanto — o ia-gateway continua sempre usando o modelo
configurado nele; isso é pra o gestor organizar/documentar, e prepara o
terreno pra quando o sistema oferecer mais de um modelo de IA.
*/

ALTER TABLE prompts_ia ADD COLUMN IF NOT EXISTS modelo_ia varchar(80) NOT NULL DEFAULT 'claude-sonnet-4-5';

UPDATE prompts_ia SET modelo_ia = 'claude-sonnet-4-5' WHERE modelo_ia IS NULL OR modelo_ia = '';
