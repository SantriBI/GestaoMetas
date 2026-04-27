DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_TABLES
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE campanhas_ativacao (
        id NUMBER(18) PRIMARY KEY,
        segmento VARCHAR2(60 CHAR) NOT NULL,
        template_id NUMBER(18),
        mensagem_base VARCHAR2(2000 CHAR),
        total_clientes NUMBER(10) DEFAULT 0 NOT NULL,
        total_com_telefone NUMBER(10) DEFAULT 0 NOT NULL,
        total_sem_telefone NUMBER(10) DEFAULT 0 NOT NULL,
        vendedor_id NUMBER(18),
        empresa_id NUMBER(18),
        data_confirmacao DATE,
        id_usuario_confirmacao NUMBER(18),
        nome_usuario_confirmacao VARCHAR2(255 CHAR),
        data_criacao DATE DEFAULT SYSDATE NOT NULL
      )
    ]';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_TABLES
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO_CLIENTES';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE campanhas_ativacao_clientes (
        id NUMBER(18) PRIMARY KEY,
        campanha_id NUMBER(18) NOT NULL,
        sk_cliente NUMBER(18),
        nome_cliente VARCHAR2(160 CHAR),
        telefone VARCHAR2(30 CHAR),
        classificacao_rfv VARCHAR2(80 CHAR),
        ultima_compra DATE,
        valor_orcamento NUMBER(18, 2),
        data_orcamento DATE,
        mensagem_final VARCHAR2(2000 CHAR),
        status_envio VARCHAR2(30 CHAR) DEFAULT 'PENDENTE' NOT NULL,
        CONSTRAINT fk_camp_ativacao_cliente_camp
          FOREIGN KEY (campanha_id) REFERENCES campanhas_ativacao (id),
        CONSTRAINT ck_camp_ativacao_status_envio
          CHECK (status_envio IN ('PENDENTE', 'LINK_GERADO', 'ENVIADO_WEBHOOK'))
      )
    ]';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'DATA_CONFIRMACAO';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE campanhas_ativacao ADD (data_confirmacao DATE)';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'ID_USUARIO_CONFIRMACAO';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE campanhas_ativacao ADD (id_usuario_confirmacao NUMBER(18))';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'NOME_USUARIO_CONFIRMACAO';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE campanhas_ativacao ADD (nome_usuario_confirmacao VARCHAR2(255 CHAR))';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_CAMP_ATIVACAO_LOOKUP';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE INDEX idx_camp_ativacao_lookup
        ON campanhas_ativacao (empresa_id, vendedor_id, data_criacao)
    ';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_CAMP_ATIVACAO_SEGMENTO';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE INDEX idx_camp_ativacao_segmento
        ON campanhas_ativacao (segmento, data_criacao)
    ';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_CAMP_ATIV_CLIENTES_CAMP';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE INDEX idx_camp_ativ_clientes_camp
        ON campanhas_ativacao_clientes (campanha_id, status_envio)
    ';
  END IF;
END;
/

DECLARE
  v_total NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_total
    FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_CAMP_ATIV_CLIENTE_SK';

  IF v_total = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE INDEX idx_camp_ativ_cliente_sk
        ON campanhas_ativacao_clientes (sk_cliente, campanha_id)
    ';
  END IF;
END;
/

COMMENT ON TABLE campanhas_ativacao IS 'Cabecalho das campanhas da central de ativacao de clientes.';
COMMENT ON COLUMN campanhas_ativacao.data_confirmacao IS 'Data em que a campanha foi confirmada.';
COMMENT ON COLUMN campanhas_ativacao.id_usuario_confirmacao IS 'Usuario que confirmou a campanha.';
COMMENT ON COLUMN campanhas_ativacao.nome_usuario_confirmacao IS 'Nome do usuario que confirmou a campanha.';

COMMENT ON TABLE campanhas_ativacao_clientes IS 'Clientes vinculados a cada campanha de ativacao.';
COMMENT ON COLUMN campanhas_ativacao_clientes.mensagem_final IS 'Mensagem personalizada final enviada ao cliente.';
COMMENT ON COLUMN campanhas_ativacao_clientes.status_envio IS 'Status do preparo/envio da campanha para o cliente.';
