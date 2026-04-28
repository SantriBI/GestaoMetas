-- Modulo de desafios comerciais do SIP na versao multi-meta.
-- Estrutura pensada para uma UX simples no front, mas robusta no backend.

CREATE TABLE GM_TB_DESAFIOS_COMERCIAIS (
  id_desafio NUMBER(18) PRIMARY KEY,
  empresa_id NUMBER(18),
  titulo VARCHAR2(160 CHAR) NOT NULL,
  descricao VARCHAR2(500 CHAR),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status VARCHAR2(20 CHAR) DEFAULT 'RASCUNHO' NOT NULL,
  exige_aceite CHAR(1) DEFAULT 'S' NOT NULL,
  criado_por VARCHAR2(120 CHAR),
  criado_em DATE DEFAULT SYSDATE NOT NULL,
  atualizado_em DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT ck_desafios_status CHECK (status IN ('RASCUNHO', 'AGENDADO', 'ATIVO', 'ENCERRADO', 'CANCELADO')),
  CONSTRAINT ck_desafios_aceite CHECK (exige_aceite IN ('S', 'N'))
);

CREATE INDEX idx_desafios_status_periodo
  ON GM_TB_DESAFIOS_COMERCIAIS (status, data_inicio, data_fim);

CREATE INDEX idx_desafios_empresa
  ON GM_TB_DESAFIOS_COMERCIAIS (empresa_id, status);

CREATE TABLE GM_TB_DESAFIOS_COMERCIAIS_METAS (
  id_meta NUMBER(18) PRIMARY KEY,
  id_desafio NUMBER(18) NOT NULL,
  tipo_meta VARCHAR2(40 CHAR) NOT NULL,
  meta_valor NUMBER(18, 2) NOT NULL,
  unidade_meta VARCHAR2(40 CHAR),
  recompensa_valor NUMBER(18, 2) DEFAULT 0 NOT NULL,
  ordem_exibicao NUMBER(4) DEFAULT 1 NOT NULL,
  config_json CLOB,
  criado_em DATE DEFAULT SYSDATE NOT NULL,
  atualizado_em DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_desafios_meta_desafio
    FOREIGN KEY (id_desafio) REFERENCES GM_TB_DESAFIOS_COMERCIAIS (id_desafio),
  CONSTRAINT ck_desafios_tipo_meta
    CHECK (tipo_meta IN ('FATURAMENTO', 'PEDIDOS_FECHADOS', 'CLIENTES_ATENDIDOS', 'RECUPERAR_CLIENTES', 'PRODUTO_OU_MARCA'))
);

CREATE INDEX idx_desafios_metas_desafio
  ON GM_TB_DESAFIOS_COMERCIAIS_METAS (id_desafio, ordem_exibicao);

CREATE TABLE GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES (
  id NUMBER(18) PRIMARY KEY,
  id_desafio NUMBER(18) NOT NULL,
  sk_vendedor NUMBER(18) NOT NULL,
  nome_vendedor VARCHAR2(160 CHAR),
  status_participacao VARCHAR2(20 CHAR) DEFAULT 'DISPONIVEL' NOT NULL,
  visualizado_em DATE,
  aceito_em DATE,
  premio_total_liberado NUMBER(18, 2) DEFAULT 0 NOT NULL,
  concluido_em DATE,
  ultima_atualizacao DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_desafios_vendedor_desafio
    FOREIGN KEY (id_desafio) REFERENCES GM_TB_DESAFIOS_COMERCIAIS (id_desafio),
  CONSTRAINT uk_desafio_vendedor UNIQUE (id_desafio, sk_vendedor),
  CONSTRAINT ck_desafios_status_participacao
    CHECK (status_participacao IN ('CONVIDADO', 'DISPONIVEL', 'ACEITO', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXPIRADO', 'RECUSADO'))
);

CREATE INDEX idx_desafios_vendedores_lookup
  ON GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES (sk_vendedor, status_participacao, visualizado_em);

CREATE TABLE GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO (
  id NUMBER(18) PRIMARY KEY,
  id_desafio NUMBER(18) NOT NULL,
  id_meta NUMBER(18) NOT NULL,
  sk_vendedor NUMBER(18) NOT NULL,
  progresso_atual NUMBER(18, 2) DEFAULT 0 NOT NULL,
  percentual_conclusao NUMBER(7, 2) DEFAULT 0 NOT NULL,
  concluido_em DATE,
  premio_liberado CHAR(1) DEFAULT 'N' NOT NULL,
  premio_valor NUMBER(18, 2) DEFAULT 0 NOT NULL,
  ultima_atualizacao DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_desafios_progresso_desafio
    FOREIGN KEY (id_desafio) REFERENCES GM_TB_DESAFIOS_COMERCIAIS (id_desafio),
  CONSTRAINT fk_desafios_progresso_meta
    FOREIGN KEY (id_meta) REFERENCES GM_TB_DESAFIOS_COMERCIAIS_METAS (id_meta),
  CONSTRAINT uk_desafios_progresso UNIQUE (id_meta, sk_vendedor),
  CONSTRAINT ck_desafios_premio_liberado CHECK (premio_liberado IN ('S', 'N'))
);

CREATE INDEX idx_desafios_progresso_lookup
  ON GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO (id_desafio, sk_vendedor, id_meta);

CREATE TABLE GM_TB_DESAFIOS_COMERCIAIS_LOG (
  id NUMBER(18) PRIMARY KEY,
  id_desafio NUMBER(18) NOT NULL,
  sk_vendedor NUMBER(18),
  evento VARCHAR2(40 CHAR) NOT NULL,
  descricao VARCHAR2(500 CHAR),
  data_evento DATE DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_desafios_log_desafio
    FOREIGN KEY (id_desafio) REFERENCES GM_TB_DESAFIOS_COMERCIAIS (id_desafio)
);

CREATE INDEX idx_desafios_log_desafio
  ON GM_TB_DESAFIOS_COMERCIAIS_LOG (id_desafio, data_evento DESC);

CREATE SEQUENCE desafios_comerciais_seq START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE desafios_comerciais_metas_seq START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE desafios_comerciais_vendedores_seq START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE desafios_comerciais_progresso_seq START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE desafios_comerciais_log_seq START WITH 1 INCREMENT BY 1 NOCACHE;

COMMENT ON TABLE GM_TB_DESAFIOS_COMERCIAIS IS 'Cabecalho do desafio/campanha.';
COMMENT ON TABLE GM_TB_DESAFIOS_COMERCIAIS_METAS IS 'Metas internas do desafio. Um desafio pode ter uma ou varias metas.';
COMMENT ON COLUMN GM_TB_DESAFIOS_COMERCIAIS_METAS.config_json IS 'Configuracoes opcionais por meta, como marca, produto, categoria ou modo de medicao.';
COMMENT ON TABLE GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES IS 'Participacao do vendedor no desafio, incluindo aceite e visualizacao.';
COMMENT ON TABLE GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO IS 'Progresso por meta e por vendedor.';
COMMENT ON TABLE GM_TB_DESAFIOS_COMERCIAIS_LOG IS 'Historico dos eventos do desafio.';
