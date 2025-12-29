#!/bin/bash
# Setup Ansible in isolated conda environment

set -e

echo "🐍 Setting up Ansible conda environment..."

# Create conda environment
conda env create -f environment.yml

echo ""
echo "✅ Ansible environment created successfully!"
echo ""
echo "To activate and use Ansible:"
echo "  conda activate ansible-env"
echo "  ansible-playbook -i inventory.yml playbook.yml"
echo ""
echo "Or use the deploy script:"
echo "  ./deploy_with_conda.sh"
echo ""
