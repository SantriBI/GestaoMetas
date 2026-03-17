CREATE TABLE INSIGHTS_VENDEDOR (
  vendedor_id NUMBER NOT NULL,
  data_referencia DATE NOT NULL,
  insights_json CLOB NOT NULL,
  origem VARCHAR2(50),
  payload_json CLOB,
  atualizado_em DATE DEFAULT SYSDATE NOT NULL
);

CREATE UNIQUE INDEX UX_INSIGHTS_VENDEDOR
  ON INSIGHTS_VENDEDOR (vendedor_id, data_referencia);
