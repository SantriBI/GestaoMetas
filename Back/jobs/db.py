from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator

import mysql.connector
import oracledb

from .config import mysql_config
from .crypto_utils import decrypt_secret


@contextmanager
def mysql_connection() -> Iterator[mysql.connector.MySQLConnection]:
    conn = mysql.connector.connect(**mysql_config())
    try:
        yield conn
    finally:
        conn.close()


def fetch_organizations(empresa_id: int | None = None) -> list[dict[str, Any]]:
    where = "WHERE ativo = 'S'"
    params: tuple[Any, ...] = ()
    if empresa_id is not None:
        where += " AND id_organizacao = %s"
        params = (empresa_id,)

    with mysql_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT
              id_organizacao,
              nome,
              codigo,
              ativo,
              oracle_user,
              oracle_password,
              oracle_connect_string,
              db_name
            FROM organizacoes_auth
            {where}
            ORDER BY id_organizacao
            """,
            params,
        )
        return list(cursor.fetchall())


def save_diagnostic(id_organizacao: int, status: str, message: str, payload: dict[str, Any]) -> None:
    with mysql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cursor.execute(
            """
            INSERT INTO organizacoes_diagnosticos
              (id_organizacao, status, mensagem, payload_json)
            VALUES (%s, %s, %s, %s)
            """,
            (id_organizacao, status, message, json.dumps(payload, default=str)),
        )
        conn.commit()


@contextmanager
def oracle_connection(org: dict[str, Any]) -> Iterator[oracledb.Connection]:
    password = decrypt_secret(org.get("oracle_password"))
    conn = oracledb.connect(
        user=org.get("oracle_user"),
        password=password,
        dsn=org.get("oracle_connect_string"),
    )
    try:
        yield conn
    finally:
        conn.close()


def oracle_fetch_all(conn: oracledb.Connection, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(sql, params or {})
    columns = [col[0].lower() for col in cursor.description or []]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
