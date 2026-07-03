from __future__ import annotations

from typing import Any

from prefect import flow, get_run_logger, task

from .db import fetch_organizations, oracle_connection, oracle_fetch_all, save_diagnostic


REQUIRED_VIEWS = [
    "VW_RANKING_VENDEDORES",
    "VW_RANKING_VENDEDORES_DIA",
    "VW_ORCAMENTOS_GESTAO_METAS",
]


def _status_from_checks(errors: list[str], warnings: list[str]) -> str:
    if errors:
        return "ERROR"
    if warnings:
        return "WARN"
    return "OK"


@task(retries=2, retry_delay_seconds=10)
def load_organizations(empresa_id: int | None = None) -> list[dict[str, Any]]:
    return fetch_organizations(empresa_id)


@task(retries=1, retry_delay_seconds=5)
def validate_organization(org: dict[str, Any]) -> dict[str, Any]:
    logger = get_run_logger()
    org_id = int(org["id_organizacao"])
    errors: list[str] = []
    warnings: list[str] = []
    payload: dict[str, Any] = {
        "id_organizacao": org_id,
        "nome": org.get("nome"),
        "checks": {},
    }

    missing_credentials = [
        field
        for field in ["oracle_user", "oracle_password", "oracle_connect_string"]
        if not org.get(field)
    ]
    if missing_credentials:
        errors.append(f"Credenciais Oracle incompletas: {', '.join(missing_credentials)}")
        payload["checks"]["credentials"] = {"ok": False, "missing": missing_credentials}
        status = _status_from_checks(errors, warnings)
        save_diagnostic(org_id, status, "; ".join(errors), payload)
        return {"id_organizacao": org_id, "status": status, "errors": errors, "warnings": warnings}

    try:
        with oracle_connection(org) as conn:
            oracle_fetch_all(conn, "SELECT 1 AS ok FROM dual")
            payload["checks"]["connection"] = {"ok": True}

            view_rows = oracle_fetch_all(
                conn,
                """
                SELECT object_name, status
                FROM user_objects
                WHERE object_type = 'VIEW'
                  AND object_name IN ({placeholders})
                """.format(placeholders=", ".join(f"'{name}'" for name in REQUIRED_VIEWS)),
            )
            views = {row["object_name"]: row["status"] for row in view_rows}
            missing_views = [name for name in REQUIRED_VIEWS if name not in views]
            invalid_views = [name for name, status in views.items() if status != "VALID"]

            if missing_views:
                errors.append(f"Views ausentes: {', '.join(missing_views)}")
            if invalid_views:
                errors.append(f"Views invalidas: {', '.join(invalid_views)}")

            payload["checks"]["views"] = {
                "required": REQUIRED_VIEWS,
                "found": views,
                "missing": missing_views,
                "invalid": invalid_views,
            }

            counts = {}
            for key, sql in {
                "ranking_mensal": "SELECT COUNT(*) AS total FROM VW_RANKING_VENDEDORES",
                "ranking_diario": "SELECT COUNT(*) AS total FROM VW_RANKING_VENDEDORES_DIA",
                "orcamentos": "SELECT COUNT(*) AS total FROM VW_ORCAMENTOS_GESTAO_METAS",
            }.items():
                rows = oracle_fetch_all(conn, sql)
                counts[key] = int(rows[0]["total"] if rows else 0)

            try:
                rows = oracle_fetch_all(conn, "SELECT COUNT(*) AS total FROM DM_VENDAS.FATO_RFV_VENDEDOR")
                counts["rfv_vendedor"] = int(rows[0]["total"] if rows else 0)
            except Exception as exc:
                counts["rfv_vendedor"] = None
                warnings.append(f"RFV vendedor indisponivel: {exc}")

            for key, total in counts.items():
                if total == 0:
                    warnings.append(f"Sem dados em {key}")

            payload["checks"]["counts"] = counts

    except Exception as exc:
        errors.append(str(exc))
        payload["checks"]["connection"] = {"ok": False, "error": str(exc)}

    status = _status_from_checks(errors, warnings)
    message_parts = errors or warnings or ["Organizacao validada com sucesso"]
    message = "; ".join(message_parts)
    save_diagnostic(org_id, status, message, payload)
    logger.info("Organizacao %s validada com status %s", org_id, status)
    return {
        "id_organizacao": org_id,
        "nome": org.get("nome"),
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "payload": payload,
    }


@flow(name="validar-organizacoes")
def validate_organizations(empresa_id: int | None = None) -> list[dict[str, Any]]:
    organizations = load_organizations(empresa_id)
    return [validate_organization(org) for org in organizations]
