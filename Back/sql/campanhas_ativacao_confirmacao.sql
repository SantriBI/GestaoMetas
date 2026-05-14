DECLARE
  v_table_exists NUMBER := 0;
  v_column_exists NUMBER := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_table_exists
    FROM USER_TABLES
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO';

  IF v_table_exists = 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'Tabela CAMPANHAS_ATIVACAO nao encontrada.');
  END IF;

  SELECT COUNT(*)
    INTO v_column_exists
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'DATA_CONFIRMACAO';

  IF v_column_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE CAMPANHAS_ATIVACAO ADD (data_confirmacao DATE)';
  END IF;

  SELECT COUNT(*)
    INTO v_column_exists
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'ID_USUARIO_CONFIRMACAO';

  IF v_column_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE CAMPANHAS_ATIVACAO ADD (id_usuario_confirmacao NUMBER)';
  END IF;

  SELECT COUNT(*)
    INTO v_column_exists
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CAMPANHAS_ATIVACAO'
     AND COLUMN_NAME = 'NOME_USUARIO_CONFIRMACAO';

  IF v_column_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE CAMPANHAS_ATIVACAO ADD (nome_usuario_confirmacao VARCHAR2(255 CHAR))';
  END IF;
END;
/

COMMENT ON COLUMN CAMPANHAS_ATIVACAO.data_confirmacao IS 'Data em que a campanha foi confirmada.';
COMMENT ON COLUMN CAMPANHAS_ATIVACAO.id_usuario_confirmacao IS 'Usuario que confirmou a campanha.';
COMMENT ON COLUMN CAMPANHAS_ATIVACAO.nome_usuario_confirmacao IS 'Nome do usuario que confirmou a campanha.';
