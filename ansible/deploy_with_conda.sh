#!/bin/bash
# Deploy using Ansible in conda environment

set -e

echo "🚀 Starting deployment with Ansible (conda environment)..."

# Check if conda environment exists
if ! conda env list | grep -q "ansible-env"; then
    echo "❌ Ansible conda environment not found!"
    echo "   Run: ./setup_ansible_env.sh"
    exit 1
fi

# Activate conda environment and run deployment
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate ansible-env

echo "🔍 Testing connection to remote server..."
ansible production -i inventory.yml -m ping

echo "📦 Running deployment playbook..."
ansible-playbook -i inventory.yml playbook.yml --ask-become-pass

conda deactivate

echo ""
echo "✅ Deployment completed!"
echo ""
