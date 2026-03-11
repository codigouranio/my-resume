#!/bin/bash

set -e

echo "📦 Running deployment playbook..."
ansible-playbook update-services.yml --ask-vault-pass --ask-become-pass -vvv
ansible-playbook -i inventory.yml playbooks/03-application-deploy.yml -b --ask-become-pass --ask-vault-pass -vvv

echo ""
echo "✅ Deployment completed!"
echo ""
