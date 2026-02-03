# Multi-RTX 3090 Server Configuration

## 🎯 Overview

Configuración para servidor con **3x RTX 3090** para 18-24 usuarios concurrentes en ResumeCast.

## 🖥️ Hardware Requirements

### Server Specs
```
Motherboard:     ASUS Pro WS X570-ACE o similar
CPU:            AMD Ryzen 9 5900X o Intel i9-12900K
RAM:             128 GB DDR4-3200 (4x32GB)
GPU Slots:        3x PCIe 4.0 x16 slots
Power Supply:     2000W+ Platinum rated
Storage:         2TB NVMe SSD + 4TB SATA SSD
Cooling:         Liquid cooling for GPUs
```

### GPU Configuration
```
GPU 1: RTX 3090 - Primary (port 11434)
GPU 2: RTX 3090 - Secondary (port 11435)  
GPU 3: RTX 3090 - Tertiary (port 11436)
Total VRAM:     72 GB (3 × 24 GB)
```

## 🐧 Linux Server Setup

### 1. Install NVIDIA Drivers
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install build tools
sudo apt install -y build-essential dkms

# Download NVIDIA drivers (525+)
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda_12.2.0_535.54.03_linux.run

# Install drivers
sudo sh cuda_12.2.0_535.54.03_linux.run

# Reboot
sudo reboot
```

### 2. Install Docker with NVIDIA support
```bash
# Add NVIDIA Docker repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io nvidia-docker2

# Restart Docker
sudo systemctl restart docker
```

### 3. Verify Multi-GPU Detection
```bash
# Check all GPUs
nvidia-smi

# Should show 3x RTX 3090
# GPU 0: RTX 3090 (UUID: GPU-xxxxxxxx)
# GPU 1: RTX 3090 (UUID: GPU-yyyyyyyy)  
# GPU 2: RTX 3090 (UUID: GPU-zzzzzzz)
```

## 🚀 Multi-GPU Ollama Setup

### Option 1: Single Ollama with GPU Affinity
<tool_call>write
<arg_key>content</arg_key>
<arg_value>#!/bin/bash
# Multi-GPU Ollama Load Balancer
# Distributes requests across 3 RTX 3090s

# Configuration
GPU_PORTS=(11434 11435 11436)
GPU_IDS=(0 1 2)
OLLAMA_MODELS=("gemma2:9b-q4_K_M" "gemma2:9b-q4_K_M" "gemma2:9b-q4_K_M")
CONTAINER_NAMES=("ollama-gpu0" "ollama-gpu1" "ollama-gpu2")

# Stop existing containers
echo "🛑 Stopping existing Ollama containers..."
for container in "${CONTAINER_NAMES[@]}"; do
    docker stop $container 2>/dev/null || true
    docker rm $container 2>/dev/null || true
done

# Create network if not exists
docker network create ollama-network 2>/dev/null || true

# Start Ollama instances
echo "🚀 Starting Ollama instances..."

for i in {0..2}; do
    echo "Starting Ollama instance $i on GPU ${GPU_IDS[$i]}"
    
    docker run -d \
        --name ${CONTAINER_NAMES[$i]} \
        --gpus '"device='"${GPU_IDS[$i]}"'"' \
        --network ollama-network \
        -p ${GPU_PORTS[$i]}:11434 \
        -v ollama-data-${i}:/root/.ollama \
        -e OLLAMA_HOST=0.0.0.0 \
        -e OLLAMA_ORIGINS="*" \
        -e OLLAMA_NUM_PARALLEL=4 \
        -e OLLAMA_MAX_QUEUE=256 \
        -e OLLAMA_CONTEXT_SIZE=4096 \
        -e OLLAMA_MAX_LOADED_MODELS=1 \
        --restart unless-stopped \
        ollama/ollama:latest
    
    echo "Pulling model for GPU $i..."
    docker exec ${CONTAINER_NAMES[$i]} ollama pull ${OLLAMA_MODELS[$i]}
done

echo "✅ All Ollama instances started"
echo "GPU 0: http://172.16.23.127:11434"
echo "GPU 1: http://172.16.23.127:11435" 
echo "GPU 2: http://172.16.23.127:11436"

# Wait for containers to be ready
echo "⏳ Waiting for Ollama instances to be ready..."
sleep 30

# Test all instances
for i in {0..2}; do
    echo "Testing Ollama instance $i..."
    curl -s http://172.16.23.127:${GPU_PORTS[$i]}/api/tags || echo "❌ Instance $i not responding"
done

echo "🎯 Multi-GPU Ollama setup complete!"