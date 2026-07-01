CREATE TABLE TB_WHATSAPP_INSTANCIAS (
  sk_vendedor       VARCHAR2(100)  NOT NULL,
  instance_name     VARCHAR2(200)  NOT NULL,
  ativo             NUMBER(1)      DEFAULT 1 NOT NULL,
  instancia_default NUMBER(1)      DEFAULT 0 NOT NULL,
  data_criacao      DATE           DEFAULT SYSDATE NOT NULL,
  data_atualizacao  DATE,
  CONSTRAINT pk_whatsapp_instancias PRIMARY KEY (sk_vendedor)
);

CREATE UNIQUE INDEX idx_whatsapp_instance_name ON TB_WHATSAPP_INSTANCIAS (instance_name);
