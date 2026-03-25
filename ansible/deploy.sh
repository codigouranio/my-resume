#!/bin/sh

set -e

INVENTORY_FILE="${INVENTORY_FILE:-inventory-production.yml}"
if [ ! -f "${INVENTORY_FILE}" ]; then
	INVENTORY_FILE="inventory.yml"
fi

LIMIT_HOSTS="${1:-${DEPLOY_LIMIT:-production}}"
if [ -n "${LIMIT_HOSTS}" ]; then
	LIMIT_ARG="--limit ${LIMIT_HOSTS}"
else
	LIMIT_ARG=""
fi

# Prompt once for both passwords
printf 'BECOME password (sudo): '
read -rs BECOME_PASS
echo
printf 'Vault password: '
read -rs VAULT_PASS
echo

# Write vault password to a temp file so ansible-playbook can read it
VAULT_PASS_FILE="$(mktemp)"
printf '%s' "${VAULT_PASS}" > "${VAULT_PASS_FILE}"
trap 'rm -f "${VAULT_PASS_FILE}"' EXIT

export ANSIBLE_BECOME_PASSWORD="${BECOME_PASS}"

echo "📦 Running application deployment playbook..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/03-application-deploy.yml -b --vault-password-file "${VAULT_PASS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "🌐 Applying Nginx routing configuration..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/04-nginx-setup.yml -b --vault-password-file "${VAULT_PASS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "✅ Deployment completed!"
echo ""
