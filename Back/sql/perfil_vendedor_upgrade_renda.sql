ALTER TABLE perfil_vendedor
  ADD (
    salario_fixo NUMBER(18, 2),
    comissao_desejada NUMBER(18, 2)
  );

COMMENT ON COLUMN perfil_vendedor.salario_fixo IS 'Valor fixo mensal informado pelo vendedor.';
COMMENT ON COLUMN perfil_vendedor.comissao_desejada IS 'Valor de comissao que o vendedor deseja conquistar para complementar o salario.';
