CREATE TABLE GM_TB_OBJETIVOS_VENDEDOR (
  id_objetivo NUMBER(18) PRIMARY KEY,
  empresa_id NUMBER(18) NOT NULL,
  vendedor_id NUMBER(18) NOT NULL,
  sk_vendedor NUMBER(18),
  nome_objetivo VARCHAR2(160 CHAR) NOT NULL,
  valor_objetivo NUMBER(18, 2) NOT NULL,
  data_limite DATE NOT NULL,
  ativo CHAR(1) DEFAULT 'S' NOT NULL,
  criado_em DATE DEFAULT SYSDATE NOT NULL,
  atualizado_em DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT ck_objetivos_vendedor_ativo CHECK (ativo IN ('S', 'N'))
);

CREATE INDEX idx_objetivos_vendedor_lookup
  ON GM_TB_OBJETIVOS_VENDEDOR (empresa_id, vendedor_id, ativo, atualizado_em);

CREATE INDEX idx_objetivos_vendedor_seller
  ON GM_TB_OBJETIVOS_VENDEDOR (sk_vendedor, vendedor_id, empresa_id, atualizado_em);

CREATE SEQUENCE objetivos_vendedor_seq START WITH 1 INCREMENT BY 1 NOCACHE;

COMMENT ON TABLE GM_TB_OBJETIVOS_VENDEDOR IS 'Objetivos financeiros pessoais do vendedor.';
COMMENT ON COLUMN GM_TB_OBJETIVOS_VENDEDOR.valor_objetivo IS 'Valor total que o vendedor deseja conquistar.';
COMMENT ON COLUMN GM_TB_OBJETIVOS_VENDEDOR.data_limite IS 'Data alvo para concluir a conquista pessoal.';
