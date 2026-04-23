CREATE TABLE perfil_vendedor (
  id NUMBER(18) PRIMARY KEY,
  vendedor_id NUMBER(18) NOT NULL,
  empresa_id NUMBER(18) NOT NULL,
  renda_desejada NUMBER(18, 2),
  salario_fixo NUMBER(18, 2),
  comissao_desejada NUMBER(18, 2),
  motivo_trabalho VARCHAR2(200 CHAR),
  para_quem_trabalha VARCHAR2(200 CHAR),
  objetivos_pessoais VARCHAR2(400 CHAR),
  preferencias_produto VARCHAR2(160 CHAR),
  criado_em DATE DEFAULT SYSDATE NOT NULL
);

CREATE UNIQUE INDEX uk_perfil_vendedor_lookup
  ON perfil_vendedor (empresa_id, vendedor_id);

CREATE SEQUENCE perfil_vendedor_seq START WITH 1 INCREMENT BY 1 NOCACHE;

COMMENT ON TABLE perfil_vendedor IS 'Perfil pessoal do vendedor para personalizacao do painel Minha Meta de Vida.';
COMMENT ON COLUMN perfil_vendedor.renda_desejada IS 'Valor de renda que o vendedor deseja atingir no mes.';
COMMENT ON COLUMN perfil_vendedor.salario_fixo IS 'Valor fixo mensal informado pelo vendedor.';
COMMENT ON COLUMN perfil_vendedor.comissao_desejada IS 'Valor de comissao que o vendedor deseja conquistar para complementar o salario.';
COMMENT ON COLUMN perfil_vendedor.preferencias_produto IS 'Categoria ou familia de produtos preferida pelo vendedor.';
