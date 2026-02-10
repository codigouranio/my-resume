#!/bin/bash

set -e

echo "📦 Running deployment playbook..."
ansible-playbook -i inventory.yml playbooks/03-application-deploy.yml -b --ask-become-pass --ask-vault-pass -vvv

echo ""
echo "✅ Deployment completed!"
echo ""
