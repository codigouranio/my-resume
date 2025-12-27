#!/usr/bin/env bash
set -e

echo "🚀 Deploying My Resume to AWS CloudFront..."

# Check if we should use conda or venv
if command -v conda &> /dev/null && [ "$USE_CONDA" = "true" ]; then
    echo "🐍 Using Conda environment..."
    
    # Check if conda environment exists
    if ! conda env list | grep -q "my-resume-infra"; then
        echo "📦 Creating Conda environment..."
        conda env create -f environment.yml
    fi
    
    echo "🔧 Activating Conda environment..."
    eval "$(conda shell.bash hook)"
    conda activate my-resume-infra
    
    echo "📚 Updating dependencies..."
    conda env update -f environment.yml --prune
else
    echo "🐍 Using Python virtual environment..."
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo "📦 Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    echo "📚 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Build React app
echo "🏗️  Building React application..."
cd ../apps/my-resume
npm install
npm run build
cd ../../infra

# Bootstrap CDK (only needed once per account/region)
echo "🔐 Bootstrapping CDK (if needed)..."
cdk bootstrap

# Deploy the stack
echo "☁️  Deploying to AWS..."
cdk deploy --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "To view the website URL, check the CloudFormation outputs above"
echo "or run: cdk deploy --outputs-file outputs.json"
