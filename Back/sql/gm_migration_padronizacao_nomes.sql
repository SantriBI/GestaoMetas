-- Migracao de padronizacao de nomes para o prefixo GM_TB_ / GM_VW_
-- Este script renomeia objetos internos do projeto e as views de ranking padronizadas para o sistema.
-- Para renomear as views usadas como DM_VENDAS.* no codigo, execute no schema owner dessas views.
-- Nao renomeia objetos com prefixos FATO_ ou DIM_.

SET SERVEROUTPUT ON;

DECLARE
  PROCEDURE rename_table_if_needed(p_old_name IN VARCHAR2, p_new_name IN VARCHAR2) IS
    v_old_count NUMBER := 0;
    v_new_count NUMBER := 0;
  BEGIN
    SELECT COUNT(*)
      INTO v_old_count
      FROM USER_TABLES
     WHERE TABLE_NAME = UPPER(p_old_name);

    SELECT COUNT(*)
      INTO v_new_count
      FROM USER_TABLES
     WHERE TABLE_NAME = UPPER(p_new_name);

    IF v_new_count > 0 THEN
      DBMS_OUTPUT.PUT_LINE('Tabela ja esta padronizada: ' || UPPER(p_new_name));
      RETURN;
    END IF;

    IF v_old_count = 0 THEN
      DBMS_OUTPUT.PUT_LINE('Tabela nao encontrada, pulando: ' || UPPER(p_old_name));
      RETURN;
    END IF;

    EXECUTE IMMEDIATE
      'RENAME ' || DBMS_ASSERT.SIMPLE_SQL_NAME(UPPER(p_old_name)) ||
      ' TO ' || DBMS_ASSERT.SIMPLE_SQL_NAME(UPPER(p_new_name));

    DBMS_OUTPUT.PUT_LINE('Tabela renomeada: ' || UPPER(p_old_name) || ' -> ' || UPPER(p_new_name));
  END;

  PROCEDURE rename_view_if_needed(p_old_name IN VARCHAR2, p_new_name IN VARCHAR2) IS
    v_old_count NUMBER := 0;
    v_new_count NUMBER := 0;
  BEGIN
    SELECT COUNT(*)
      INTO v_old_count
      FROM USER_VIEWS
     WHERE VIEW_NAME = UPPER(p_old_name);

    SELECT COUNT(*)
      INTO v_new_count
      FROM USER_VIEWS
     WHERE VIEW_NAME = UPPER(p_new_name);

    IF v_new_count > 0 THEN
      DBMS_OUTPUT.PUT_LINE('View ja esta padronizada: ' || UPPER(p_new_name));
      RETURN;
    END IF;

    IF v_old_count = 0 THEN
      DBMS_OUTPUT.PUT_LINE('View nao encontrada, pulando: ' || UPPER(p_old_name));
      RETURN;
    END IF;

    EXECUTE IMMEDIATE
      'RENAME ' || DBMS_ASSERT.SIMPLE_SQL_NAME(UPPER(p_old_name)) ||
      ' TO ' || DBMS_ASSERT.SIMPLE_SQL_NAME(UPPER(p_new_name));

    DBMS_OUTPUT.PUT_LINE('View renomeada: ' || UPPER(p_old_name) || ' -> ' || UPPER(p_new_name));
  END;
BEGIN
  -- Modulo Minha Meta de Vida
  rename_table_if_needed('PERFIL_VENDEDOR', 'GM_TB_PERFIL_VENDEDOR');
  rename_table_if_needed('OBJETIVOS_VENDEDOR', 'GM_TB_OBJETIVOS_VENDEDOR');

  -- Modulo Desafios
  rename_table_if_needed('DESAFIOS_COMERCIAIS', 'GM_TB_DESAFIOS_COMERCIAIS');
  rename_table_if_needed('DESAFIOS_COMERCIAIS_METAS', 'GM_TB_DESAFIOS_COMERCIAIS_METAS');
  rename_table_if_needed('DESAFIOS_COMERCIAIS_VENDEDORES', 'GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES');
  rename_table_if_needed('DESAFIOS_COMERCIAIS_PROGRESSO', 'GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO');
  rename_table_if_needed('DESAFIOS_COMERCIAIS_LOG', 'GM_TB_DESAFIOS_COMERCIAIS_LOG');

  -- Modulo Ativacao de Clientes
  rename_table_if_needed('CAMPANHAS_ATIVACAO', 'GM_TB_CAMPANHAS_ATIVACAO');
  rename_table_if_needed('CAMPANHAS_ATIVACAO_CLIENTES', 'GM_TB_CAMPANHAS_ATIVACAO_CLIENTES');
  rename_table_if_needed('TEMPLATES_MENSAGENS', 'GM_TB_TEMPLATES_MENSAGENS');

  -- Portal da Industria
  rename_table_if_needed('FORNECEDORES_LOGIN', 'GM_TB_FORNECEDORES_LOGIN');

  -- Autenticacao e apoio operacional
  rename_table_if_needed('USUARIOS_APP', 'GM_TB_USUARIOS_APP');
  rename_table_if_needed('INSIGHTS_VENDEDOR', 'GM_TB_INSIGHTS_VENDEDOR');

  -- Feed interno
  rename_table_if_needed('FEED_POSTS', 'GM_TB_FEED_POSTS');
  rename_table_if_needed('FEED_CURTIDAS', 'GM_TB_FEED_CURTIDAS');
  rename_table_if_needed('FEED_COMENTARIOS', 'GM_TB_FEED_COMENTARIOS');

  -- Views padronizadas usadas pelo projeto
  rename_view_if_needed('VW_RANKING_VENDEDORES', 'GM_VW_RANKING_VENDEDORES');
  rename_view_if_needed('VW_RANKING_VENDEDORES_DIA', 'GM_VW_RANKING_VENDEDORES_DIA');
  rename_view_if_needed('VW_RANKING_VENDEDORES_DIA_HIST', 'GM_VW_RANKING_VENDEDORES_DIA_HIST');
END;
/
