#!/bin/bash
# Quick update script for My Resume Application
# Use this to update code and restart services on existing deployment

set -e

echo "🔄 Starting update for My Resume Application..."

# Check if ansible is installed locally
if ! command -v ansible &> /dev/null; then
    echo "❌ Ansible is not installed on this machine"
    echo ""
    echo "📝 You have two options:"
    echo ""
    echo "Option 1 - Install Ansible locally and run update:"
    echo "   pip install ansible"
    echo "   # or: brew install ansible (macOS)"
    echo "   ./update.sh"
    echo ""
    echo "Option 2 - Run update playbook from remote server:"
    echo "   ssh jose@172.16.23.127"
    echo "   cd /opt/my-resume/ansible"
    echo "   ansible-playbook -i inventory.yml update.yml --connection=local"
    echo ""
    exit 1
fi

# Test connection
echo "🔍 Testing connection to remote server..."
ansible production -i inventory.yml -m ping

# Run update playbook
echo "📦 Running update playbook..."
ansible-playbook -i inventory.yml update.yml

echo ""
echo "✅ Update completed!"
echo ""
echo "📊 Useful commands on remote server:"
echo "   pm2 status              - Check service status"
echo "   pm2 logs --lines 50     - View recent logs"
echo "   pm2 restart all         - Restart all services"
echo ""
echo "🧪 Test the application:"
echo "   Frontend:  http://172.16.23.127"
echo "   API:       http://172.16.23.127:3000/api"
echo ""
