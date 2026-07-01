-- Adiciona coluna metric_type na tabela DESAFIOS_COMERCIAIS_METAS.
-- Executar como DM_VENDAS (o mesmo schema que a API usa em runtime).
-- Seguro para rodar em ambientes que ja tem a tabela criada sem esta coluna.

ALTER TABLE DESAFIOS_COMERCIAIS_METAS
  ADD metric_type VARCHAR2(20 CHAR) DEFAULT 'VALOR' NOT NULL;

-- Verificar resultado:
-- SELECT column_name, data_type, data_length, data_default, nullable
-- FROM user_tab_columns
-- WHERE table_name = 'DESAFIOS_COMERCIAIS_METAS'
-- ORDER BY column_id;
