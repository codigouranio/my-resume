#!/bin/sh

set -e

prompt_secret() {
	prompt="$1"
	printf '%s' "${prompt}" >&2
	if [ -t 0 ]; then
		stty -echo
		IFS= read -r secret
		stty echo
		echo >&2
	else
		IFS= read -r secret
	fi
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

if [ -n "${VAULT_VARS_FILE}" ]; then
	SELECTED_VAULT_VARS_FILE="${VAULT_VARS_FILE}"
elif [ -f "group_vars/all/vault.yml" ]; then
	SELECTED_VAULT_VARS_FILE="group_vars/all/vault.yml"
elif [ -f "group_vars/all/vault-sandbox.yml" ]; then
	SELECTED_VAULT_VARS_FILE="group_vars/all/vault-sandbox.yml"
else
	echo "❌ No vault vars file found (expected group_vars/all/vault.yml or vault-sandbox.yml)." >&2
	exit 1
fi

# Prompt once for both passwords (unless provided via environment)
if [ -n "${ANSIBLE_BECOME_PASSWORD}" ]; then
	BECOME_PASS="${ANSIBLE_BECOME_PASSWORD}"
else
	BECOME_PASS="$(prompt_secret 'BECOME password (sudo): ')"
fi

if [ -n "${ANSIBLE_VAULT_PASSWORD}" ]; then
	VAULT_PASS="${ANSIBLE_VAULT_PASSWORD}"
else
	VAULT_PASS="$(prompt_secret 'Vault password: ')"
fi

# Write passwords to temp files so both playbook runs can reuse them
VAULT_PASS_FILE="$(mktemp)"
printf '%s' "${VAULT_PASS}" > "${VAULT_PASS_FILE}"

BECOME_VARS_FILE="$(mktemp)"
cat > "${BECOME_VARS_FILE}" <<EOF
ansible_become_password: |-
  ${BECOME_PASS}
vault_vars_file: ${SELECTED_VAULT_VARS_FILE}
EOF

trap 'rm -f "${VAULT_PASS_FILE}" "${BECOME_VARS_FILE}"' EXIT

echo "🔐 Using vault vars file: ${SELECTED_VAULT_VARS_FILE}"

echo "📦 Running application deployment playbook..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/03-application-deploy.yml -b --vault-password-file "${VAULT_PASS_FILE}" --extra-vars "@${BECOME_VARS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "🌐 Applying Nginx routing configuration..."
ansible-playbook -i "${INVENTORY_FILE}" playbooks/04-nginx-setup.yml -b --vault-password-file "${VAULT_PASS_FILE}" --extra-vars "@${BECOME_VARS_FILE}" ${LIMIT_ARG} -vvv

echo ""
echo "✅ Deployment completed!"
echo ""
