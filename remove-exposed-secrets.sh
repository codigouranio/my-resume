#!/bin/bash
# SECURITY FIX: Remove exposed tfplan file from git history
# This removes infra/gcp/tfplan from all commits

set -e

echo "🚨 SECURITY FIX: Removing tfplan from git history"
echo "=================================================="
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "⚠️  All collaborators will need to re-clone the repo"
echo ""
read -p "Have you rotated the AWS credentials? (yes/no): " confirmed

if [ "$confirmed" != "yes" ]; then
    echo "❌ Please rotate AWS credentials FIRST, then run this script"
    echo "   Go to: https://console.aws.amazon.com/iam/"
    echo "   Deactivate key: AKIATIC76MP4DRJKHNBA"
    exit 1
fi

echo ""
echo "Step 1: Removing tfplan from git history..."

# Remove the file from all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch infra/gcp/tfplan' \
  --prune-empty --tag-name-filter cat -- --all

echo ""
echo "Step 2: Removing local tfplan file..."
rm -f infra/gcp/tfplan

echo ""
echo "Step 3: Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Git history cleaned!"
echo ""
echo "NEXT STEPS:"
echo "==========="
echo "1. Verify: git log --all -- infra/gcp/tfplan"
echo "   (should show no results)"
echo ""
echo "2. Force push to GitHub:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. Update terraform.tfvars with NEW AWS credentials"
echo ""
echo "4. Notify AWS that the key is rotated:"
echo "   (Amazon may follow up on the security alert)"
echo ""
echo "⚠️  WARNING: All collaborators must re-clone!"
echo "   They cannot just 'git pull'"
