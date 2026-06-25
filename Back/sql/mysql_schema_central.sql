-- Schema central de autenticacao e gerenciamento multi-tenant
CREATE DATABASE IF NOT EXISTS gestao_metas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestao_metas;

CREATE TABLE IF NOT EXISTS organizacoes_auth (
  id_organizacao  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(200)     NOT NULL,
  codigo          VARCHAR(50)      NOT NULL,
  descricao       TEXT,
  ativo           CHAR(1)          NOT NULL DEFAULT 'S',
  oracle_user     VARCHAR(100),
  oracle_password TEXT,
  oracle_connect_string VARCHAR(500),
  db_name         VARCHAR(100),
  criado_em       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_organizacao),
  UNIQUE KEY uq_organizacoes_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios_auth (
  id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  login           VARCHAR(200)     NOT NULL,
  senha_hash      VARCHAR(255)     NOT NULL,
  role            ENUM('SUPERADMIN','ADMIN','GERENTE','VENDEDOR','PAINEL','INDUSTRIA') NOT NULL DEFAULT 'VENDEDOR',
  empresa_id      INT UNSIGNED,
  sk_vendedor     INT,
  nome            VARCHAR(200),
  nome_completo   VARCHAR(300),
  cpf             VARCHAR(20),
  ativo           CHAR(1)          NOT NULL DEFAULT 'S',
  senha_temporaria CHAR(1)         NOT NULL DEFAULT 'N',
  foto_url        TEXT,
  token_version   INT UNSIGNED     NOT NULL DEFAULT 0,
  vendedor_id     INT,
  funcionario_id  INT,
  criado_em       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ultimo_login    DATETIME,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS organizacoes_diagnosticos (
  id_diagnostico  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_organizacao  INT UNSIGNED    NOT NULL,
  status          ENUM('OK','WARN','ERROR') NOT NULL DEFAULT 'ERROR',
  mensagem        TEXT,
  payload_json    JSON,
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_diagnostico),
  KEY idx_org_diag_org_data (id_organizacao, criado_em),
  CONSTRAINT fk_org_diag_organizacao
    FOREIGN KEY (id_organizacao)
    REFERENCES organizacoes_auth (id_organizacao)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
