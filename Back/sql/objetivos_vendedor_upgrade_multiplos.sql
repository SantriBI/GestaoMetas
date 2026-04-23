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
  ON objetivos_vendedor (empresa_id, vendedor_id, ativo, atualizado_em);

CREATE INDEX idx_objetivos_vendedor_seller
  ON objetivos_vendedor (sk_vendedor, vendedor_id, empresa_id, atualizado_em);
