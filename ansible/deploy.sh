#!/bin/sh

set -e

prompt_secret() {
	prompt="$1"
	printf '%s' "${prompt}"
	stty -echo
	IFS= read -r secret
	stty echo
	echo
	printf '%s' "${secret}"
}

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
BECOME_PASS="$(prompt_secret 'BECOME password (sudo): ')"
VAULT_PASS="$(prompt_secret 'Vault password: ')"

# Write passwords to temp files so both playbook runs can reuse them
VAULT_PASS_FILE="$(mktemp)"
printf '%s' "${VAULT_PASS}" > "${VAULT_PASS_FILE}"

BECOME_VARS_FILE="$(mktemp)"
cat > "${BECOME_VARS_FILE}" <<EOF
ansible_become_password: |-
	${BECOME_PASS}
EOF

trap 'rm -f "${VAULT_PASS_FILE}" "${BECOME_VARS_FILE}"' EXIT

echo "📦 Running application deployment playbook..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/03-application-deploy.yml -b --vault-password-file "${VAULT_PASS_FILE}" --extra-vars "@${BECOME_VARS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "🌐 Applying Nginx routing configuration..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/04-nginx-setup.yml -b --vault-password-file "${VAULT_PASS_FILE}" --extra-vars "@${BECOME_VARS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "✅ Deployment completed!"
echo ""
