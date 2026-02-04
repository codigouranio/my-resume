#!/bin/bash

# Health Check Wrapper Script
# Usage: ./scripts/health-check.sh [--remote] [--detailed] [--watch]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Run the health check
node "$SCRIPT_DIR/health-check.js" "$@"
