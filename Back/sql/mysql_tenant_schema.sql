-- Schema aplicado a cada database tenant org_<id>_<slug>
-- Executado automaticamente ao criar uma nova organizacao

CREATE TABLE IF NOT EXISTS usuarios_auth (
  id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  login           VARCHAR(200)     NOT NULL,
  senha_hash      VARCHAR(255)     NOT NULL,
  role            ENUM('ADMIN','GERENTE','VENDEDOR','PAINEL','INDUSTRIA') NOT NULL DEFAULT 'VENDEDOR',
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
  UNIQUE KEY uq_tenant_usuarios_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
