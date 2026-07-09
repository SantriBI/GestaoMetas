-- Kanban de Carteira do Vendedor (CRM).
-- Executar como DM_VENDAS (mesmo schema usado pela API em runtime).

CREATE TABLE CRM_KANBAN_CARD (
  ID                        NUMBER(18)          PRIMARY KEY,
  EMPRESA_ID                NUMBER(18)          NULL,
  SK_VENDEDOR               NUMBER(18)          NOT NULL,
  SK_CLIENTE                NUMBER(18)          NOT NULL,
  COLUNA_ATUAL              VARCHAR2(30 CHAR)   DEFAULT 'A_CONTATAR' NOT NULL,
  ORIGEM_STATUS             VARCHAR2(12 CHAR)   DEFAULT 'AUTOMATICO' NOT NULL,
  ORDEM                     NUMBER(18)          DEFAULT 0 NOT NULL,
  DATA_CRIACAO              DATE                DEFAULT SYSDATE NOT NULL,
  DATA_ULTIMA_ATUALIZACAO   DATE                DEFAULT SYSDATE NOT NULL,
  DATA_ULTIMA_MOVIMENTACAO  DATE                DEFAULT SYSDATE NOT NULL,
  ARQUIVADO                 CHAR(1 CHAR)        DEFAULT 'N' NOT NULL,
  CONSTRAINT ck_kanban_card_coluna CHECK (COLUNA_ATUAL IN
    ('A_CONTATAR', 'EM_CONTATO', 'ORCAMENTO_ENVIADO', 'CONVERTIDO', 'NAO_CONVERTIDO')),
  CONSTRAINT ck_kanban_card_origem CHECK (ORIGEM_STATUS IN ('AUTOMATICO', 'MANUAL')),
  CONSTRAINT ck_kanban_card_arquivado CHECK (ARQUIVADO IN ('S', 'N')),
  CONSTRAINT uq_kanban_card_vendedor_cliente UNIQUE (SK_VENDEDOR, SK_CLIENTE)
);

CREATE SEQUENCE CRM_KANBAN_CARD_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE INDEX IDX_KANBAN_CARD_BOARD    ON CRM_KANBAN_CARD (SK_VENDEDOR, ARQUIVADO, COLUNA_ATUAL, ORDEM);
CREATE INDEX IDX_KANBAN_CARD_CLIENTE  ON CRM_KANBAN_CARD (SK_CLIENTE);
CREATE INDEX IDX_KANBAN_CARD_VARREDURA ON CRM_KANBAN_CARD (COLUNA_ATUAL, ARQUIVADO, DATA_ULTIMA_MOVIMENTACAO);

COMMENT ON TABLE  CRM_KANBAN_CARD                          IS 'Card do kanban de carteira do vendedor: posição de um cliente no funil de relacionamento.';
COMMENT ON COLUMN CRM_KANBAN_CARD.EMPRESA_ID               IS 'Empresa/organização dona do card (consistente com as demais tabelas da feature).';
COMMENT ON COLUMN CRM_KANBAN_CARD.SK_VENDEDOR               IS 'Vendedor dono do card.';
COMMENT ON COLUMN CRM_KANBAN_CARD.SK_CLIENTE                IS 'Cliente representado pelo card.';
COMMENT ON COLUMN CRM_KANBAN_CARD.COLUNA_ATUAL              IS 'Coluna atual do funil: A_CONTATAR, EM_CONTATO, ORCAMENTO_ENVIADO, CONVERTIDO ou NAO_CONVERTIDO.';
COMMENT ON COLUMN CRM_KANBAN_CARD.ORIGEM_STATUS             IS 'Se a coluna atual foi definida pela sincronização automática (AUTOMATICO) ou por movimentação manual do vendedor (MANUAL).';
COMMENT ON COLUMN CRM_KANBAN_CARD.ORDEM                     IS 'Posição append-only do card dentro da coluna (maior = mais recente).';
COMMENT ON COLUMN CRM_KANBAN_CARD.ARQUIVADO                 IS 'S quando o card foi arquivado (sai da visão padrão do board).';

CREATE TABLE CRM_KANBAN_INTERACAO (
  ID              NUMBER(18)          PRIMARY KEY,
  CARD_ID         NUMBER(18)          NOT NULL,
  TIPO            VARCHAR2(20 CHAR)   NOT NULL,
  CONTEUDO        VARCHAR2(4000 CHAR) NULL,
  COLUNA_ORIGEM   VARCHAR2(30 CHAR)   NULL,
  COLUNA_DESTINO  VARCHAR2(30 CHAR)   NULL,
  AUTOR           VARCHAR2(150 CHAR)  NULL,
  DATA            DATE                DEFAULT SYSDATE NOT NULL,
  CONSTRAINT fk_kanban_interacao_card FOREIGN KEY (CARD_ID) REFERENCES CRM_KANBAN_CARD (ID),
  CONSTRAINT ck_kanban_interacao_tipo CHECK (TIPO IN
    ('ANOTACAO', 'LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'MUDANCA_COLUNA'))
);

CREATE SEQUENCE CRM_KANBAN_INTERACAO_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE INDEX IDX_KANBAN_INTERACAO_CARD ON CRM_KANBAN_INTERACAO (CARD_ID, DATA DESC);

COMMENT ON TABLE  CRM_KANBAN_INTERACAO                      IS 'Timeline/diário de interações registradas em um card do kanban de carteira.';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.CARD_ID              IS 'Card ao qual a interação pertence.';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.TIPO                 IS 'Tipo da interação: ANOTACAO, LIGACAO, WHATSAPP, EMAIL, REUNIAO ou MUDANCA_COLUNA (automática).';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.CONTEUDO             IS 'Texto livre da interação (obrigatório para tipos manuais).';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.COLUNA_ORIGEM        IS 'Preenchido apenas em MUDANCA_COLUNA: coluna de origem do movimento.';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.COLUNA_DESTINO       IS 'Preenchido apenas em MUDANCA_COLUNA: coluna de destino do movimento.';
COMMENT ON COLUMN CRM_KANBAN_INTERACAO.AUTOR                IS 'Nome do usuário autor da interação (ou "Sistema" quando automática).';
