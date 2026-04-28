BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX uk_objetivos_vendedor_lookup';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE NOT IN (-1418, -942) THEN
      RAISE;
    END IF;
END;
/

CREATE INDEX idx_objetivos_vendedor_lookup
  ON GM_TB_OBJETIVOS_VENDEDOR (empresa_id, vendedor_id, ativo, atualizado_em);

CREATE INDEX idx_objetivos_vendedor_seller
  ON GM_TB_OBJETIVOS_VENDEDOR (sk_vendedor, vendedor_id, empresa_id, atualizado_em);
