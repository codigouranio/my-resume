#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${DEPLOY_TARGET:-gcp}"
MODE="${1:-infra}"

usage() {
    cat <<EOF
Usage:
  ./infra/deploy.sh [mode]

Modes:
  infra      Full infrastructure deployment (Terraform apply). Default.
  code       Deploy latest local code for API + frontend (no Terraform changes).
  api        Deploy latest local code for API only.
  frontend   Deploy latest local code for frontend only.
  help       Show this help.

Examples:
  ./infra/deploy.sh
  ./infra/deploy.sh infra
  ./infra/deploy.sh code
  ./infra/deploy.sh api
  ./infra/deploy.sh frontend
EOF
}

if [[ "${MODE}" == "help" || "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
    usage
    exit 0
fi

echo "Starting deployment (target=${TARGET}, mode=${MODE})"

case "${TARGET}" in
    gcp)
        case "${MODE}" in
            infra)
                exec "${REPO_ROOT}/infra/gcp/deploy.sh"
                ;;
            code)
                exec "${REPO_ROOT}/infra/scripts/deploy-all.sh"
                ;;
            api)
                exec "${REPO_ROOT}/infra/scripts/deploy-api-service.sh"
                ;;
            frontend)
                exec "${REPO_ROOT}/infra/scripts/deploy-frontend.sh"
                ;;
            *)
                echo "Unsupported mode='${MODE}'."
                usage
                exit 1
                ;;
        esac
        ;;
    aws)
        echo "AWS deployment is no longer the default in this repository."
        echo "Use dedicated AWS scripts directly if required."
        exit 1
        ;;
    *)
        echo "Unsupported DEPLOY_TARGET='${TARGET}'. Supported values: gcp, aws"
        exit 1
        ;;
esac
