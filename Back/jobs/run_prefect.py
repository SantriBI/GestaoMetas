from __future__ import annotations

import argparse
import json
import logging
import os
import time

from .config import load_env_file
from .prefect_flows import validate_organizations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)


def main() -> None:
    load_env_file()

    parser = argparse.ArgumentParser(description="Prefect jobs for GestaoMetas.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="Validate Oracle organizations now.")
    validate_parser.add_argument("--empresa-id", type=int, default=None)

    serve_parser = subparsers.add_parser("serve", help="Serve scheduled organization validation.")
    serve_parser.add_argument(
        "--interval-seconds",
        type=int,
        default=int(os.getenv("PREFECT_VALIDATION_INTERVAL_SECONDS", "1800")),
    )

    args = parser.parse_args()

    if args.command == "validate":
        result = validate_organizations(empresa_id=args.empresa_id)
        print(json.dumps(result, indent=2, default=str))
        return

    if args.command == "serve":
        interval = args.interval_seconds
        log.info("Prefect worker iniciado. Intervalo: %ds", interval)
        while True:
            try:
                validate_organizations()
            except Exception as exc:
                log.error("Erro na execucao do flow: %s", exc)
            log.info("Proxima execucao em %ds", interval)
            time.sleep(interval)


if __name__ == "__main__":
    main()
