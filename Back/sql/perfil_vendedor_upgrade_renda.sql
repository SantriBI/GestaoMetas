ALTER TABLE GM_TB_PERFIL_VENDEDOR
  ADD (
    salario_fixo NUMBER(18, 2),
    comissao_desejada NUMBER(18, 2)
  );

COMMENT ON COLUMN GM_TB_PERFIL_VENDEDOR.salario_fixo IS 'Valor fixo mensal informado pelo vendedor.';
COMMENT ON COLUMN GM_TB_PERFIL_VENDEDOR.comissao_desejada IS 'Valor de comissao que o vendedor deseja conquistar para complementar o salario.';
