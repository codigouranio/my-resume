#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${DEPLOY_TARGET:-gcp}"

echo "Starting infrastructure deployment (target=${TARGET})"

case "${TARGET}" in
    gcp)
        exec "${REPO_ROOT}/infra/gcp/deploy.sh" "$@"
        ;;
    aws)
        echo "AWS deployment is no longer the default in this repository."
        echo "Use the dedicated AWS scripts under ${REPO_ROOT}/infra/scripts if required."
        exit 1
        ;;
    *)
        echo "Unsupported DEPLOY_TARGET='${TARGET}'. Supported values: gcp, aws"
        exit 1
        ;;
esac
