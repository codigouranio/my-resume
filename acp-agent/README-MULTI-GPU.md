# Configuración Servidor con 3x RTX 3090

## 🎯 Resumen de Configuración

**Servidor Multi-GPU para 18-24 usuarios concurrentes**
- **3x RTX 3090** = 72 GB VRAM total
- **Capacidad**: ~3,000 resumes/día
- **Usuarios concurrentes**: 18-24 cómodos
- **Response time**: 3-6 segundos

## 🖥️ Hardware Requerido

### Servidor Físico
```
Motherboard: ASUS Pro WS X570-ACE (3x PCIe x16 slots)
CPU: AMD Ryzen 9 5900X (12 cores, 24 threads)
RAM: 128 GB DDR4-3200 (4x32GB ECC)
GPU: 3x RTX 3090 (24 GB VRAM cada una)
PSU: SeaSonic PRIME TX-2000 (2000W 80+ Platinum)
Storage: 2TB Samsung 980 PRO NVMe + 4TB WD Black SATA
Cooling: Corsair Hydro X Series (custom liquid cooling)
Case: Phanteks Enthoo Pro 2 (full tower)
```

### Especificaciones de GPU
```
GPU 0: RTX 3090 - Puerto 11434
GPU 1: RTX 3090 - Puerto 11435
GPU 2: RTX 3090 - Puerto 11436
Total VRAM: 72 GB (3 × 24 GB)
CUDA Cores: 31,488 total
```

## 🐧 Instalación Linux

### 1. Sistema Base
```bash
# Instalar Ubuntu 22.04 LTS
sudo apt update && sudo apt upgrade -y

# Instalar herramientas de desarrollo
sudo apt install -y build-essential dkms git curl wget htop

# Configurar límites de usuario
echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65536' | sudo tee -a /etc/security/limits.conf
```

### 2. Drivers NVIDIA
```bash
# Descargar drivers 535+
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda_12.2.0_535.54.03_linux.run

# Instalar drivers
sudo sh cuda_12.2.0_535.54.03_linux.run

# Verificar detección de GPUs
sudo reboot

nvidia-smi
# Debe mostrar 3x RTX 3090
```

### 3. Docker con NVIDIA
```bash
# Añadir repositorio NVIDIA Docker
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io nvidia-docker2

# Configurar Docker para GPUs
sudo systemctl restart docker

# Verificar soporte multi-GPU
docker run --rm --gpus all nvidia/cuda:12.2-base nvidia-smi
```

## 🚀 Configuración Ollama Multi-GPU

### Script Automatizado
```bash
# Hacer ejecutable
chmod +x /path/to/acp-agent/scripts/setup-multigpu-ollama.sh

# Ejecutar configuración
./setup-multigpu-ollama.sh
```

### Configuración Manual
```bash
# Crear network Docker
docker network create ollama-network

# GPU 0 (Port 11434)
docker run -d \
  --name ollama-gpu0 \
  --gpus '"device=0"' \
  --network ollama-network \
  -p 11434:11434 \
  -v ollama-data-0:/root/.ollama \
  -e OLLAMA_HOST=0.0.0.0 \
  -e OLLAMA_NUM_PARALLEL=4 \
  -e OLLAMA_MAX_QUEUE=256 \
  --restart unless-stopped \
  ollama/ollama:latest

# GPU 1 (Port 11435)
docker run -d \
  --name ollama-gpu1 \
  --gpus '"device=1"' \
  --network ollama-network \
  -p 11435:11434 \
  -v ollama-data-1:/root/.ollama \
  -e OLLAMA_HOST=0.0.0.0 \
  -e OLLAMA_NUM_PARALLEL=4 \
  -e OLLAMA_MAX_QUEUE=256 \
  --restart unless-stopped \
  ollama/ollama:latest

# GPU 2 (Port 11436)
docker run -d \
  --name ollama-gpu2 \
  --gpus '"device=2"' \
  --network ollama-network \
  -p 11436:11434 \
  -v ollama-data-2:/root/.ollama \
  -e OLLAMA_HOST=0.0.0.0 \
  -e OLLAMA_NUM_PARALLEL=4 \
  -e OLLAMA_MAX_QUEUE=256 \
  --restart unless-stopped \
  ollama/ollama:latest

# Descargar modelos en cada GPU
docker exec ollama-gpu0 ollama pull gemma2:9b-q4_K_M
docker exec ollama-gpu1 ollama pull gemma2:9b-q4_K_M
docker exec ollama-gpu2 ollama pull gemma2:9b-q4_K_M
```

## 🔄 Load Balancer

### Iniciar Load Balancer
```bash
# Hacer ejecutable
chmod +x /path/to/acp-agent/scripts/loadbalancer.sh

# Iniciar load balancer (puerto 8080)
./loadbalancer.sh start

# Ver salud de GPUs
./loadbalancer.sh health

# Monitorear cargas
./loadbalancer.sh monitor
```

### Arquitectura de Balanceo
```
Client → Load Balancer:8080 → GPU Instance
                             │
                             ├─► GPU 0:11434 (6 users)
                             ├─► GPU 1:11435 (6 users)  
                             └─► GPU 2:11436 (6 users)
```

## 🤖 Multi-GPU ACP Agent

### Configuración
```bash
# Actualizar endpoints en el agent
cd /path/to/acp-agent
npm install

# Iniciar agent multi-GPU
node multigpu-agent.js
```

### Endpoints Disponibles
```
Multi-GPU ACP Agent:    http://localhost:8082
Health Check:            http://localhost:8082/health
Monitoring:             http://localhost:8082/monitor
Load Balancer:          http://localhost:8080
GPU Instances:          11434, 11435, 11436
WebSocket ACP:          ws://localhost:8081
```

## 📊 Monitoreo

### Health Check Completo
```bash
curl http://localhost:8082/health
```
**Response esperado:**
```json
{
  "agentId": "resumecast-multigpu",
  "totalGPUs": 3,
  "healthyGPUs": 3,
  "totalCapacity": 18,
  "currentLoad": 4,
  "gpuStatuses": [
    {
      "id": 0,
      "url": "http://172.16.23.127:11434",
      "status": "healthy",
      "load": 1,
      "requests": 127
    },
    {
      "id": 1, 
      "url": "http://172.16.23.127:11435",
      "status": "healthy",
      "load": 2,
      "requests": 145
    },
    {
      "id": 2,
      "url": "http://172.16.23.127:11436", 
      "status": "healthy",
      "load": 1,
      "requests": 98
    }
  ]
}
```

### Monitoring en Tiempo Real
```bash
# Monitorear cargas actuales
curl http://localhost:8082/monitor

# Ver logs de load balancer
tail -f /var/log/ollama-loadbalancer.log
```

## 🧪 Testing Multi-GPU

### Script de Pruebas
```bash
#!/bin/bash
# Test concurrent capacity across 3 GPUs

echo "🧪 Testing Multi-GPU Capacity..."
echo "=================================="

for users in 5 10 15 20 25; do
    echo "Testing $users concurrent users..."
    
    start_time=$(date +%s)
    
    # Iniciar $users requests en paralelo
    for ((i=1; i<=users; i++)); do
        {
            curl -s -X POST http://localhost:8080/api/generate \
                -H "Content-Type: application/json" \
                -d '{
                    "model": "gemma2:9b",
                    "prompt": "Generate resume for Software Engineer",
                    "stream": false
                }' > /dev/null
            echo "Request $i completed"
        } &
    done
    
    wait
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo "$users concurrent requests completed in ${duration}s"
    echo "---"
    sleep 2
done
```

## 📈 Capacidad y Performance

### Métricas Esperadas
```
Capacidad Total:       18 usuarios concurrentes
Resumes por día:      3,000+
Response Time:         3-6 segundos
GPU Utilización:       80-95% distribuida
Throughput:           125 resumes/hora
```

### Escalado Horizontal
```
1 Server (3x RTX 3090):   18 concurrentes
2 Servers (6x RTX 3090):   36 concurrentes  
4 Servers (12x RTX 3090):  72 concurrentes
```

## 🔧 Optimización

### Variables de Entorno
```bash
# Para cada instancia Ollama
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_QUEUE=256
OLLAMA_CONTEXT_SIZE=4096
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_GPU_LAYERS=35
OLLAMA_TIMEOUT=120
```

### Configuración del Sistema
```bash
# Optimizar kernel para alto throughput
echo 'net.core.rmem_max = 134217728' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 134217728' | sudo tee -a /etc/sysctl.conf
echo 'vm.swappiness = 10' | sudo tee -a /etc/sysctl.conf

sudo sysctl -p
```

## 🚨 Troubleshooting

### Common Issues
```bash
# GPU no detectada
nvidia-smi
lspci | grep -i nvidia

# Docker GPU issues
docker run --rm --gpus all nvidia/cuda:12.2-base nvidia-smi

# Ollama no responde
curl -I http://172.16.23.127:11434/api/tags
curl -I http://172.16.23.127:11435/api/tags  
curl -I http://172.16.23.127:11436/api/tags

# Load balancer caído
curl -I http://localhost:8080/health
```

### Logs Importantes
```bash
# Logs de Ollama containers
docker logs ollama-gpu0
docker logs ollama-gpu1
docker logs ollama-gpu2

# Logs de ACP Agent
journalctl -u multigpu-acp-agent -f

# Logs del load balancer
tail -f /var/log/ollama-loadbalancer.log
```

## 💰 Cost Estimation

### Hardware Costs
```
3x RTX 3090:         $3,000
Server Components:     $4,000
Total Hardware:        $7,000
```

### Operating Costs
```
Power (3x 350W):      $150/month
Cooling:              $50/month
Bandwidth:             $100/month
Total Operating:       $300/month
```

### Capacity Value
```
Daily Resumes:         3,000
Monthly Resumes:       90,000
Cost per Resume:       $0.01
Revenue Potential:     $9,000/month (@ $100/resume)
```

## 🎯 Checklist de Implementación

- [ ] Hardware montado y testeado
- [ ] Drivers NVIDIA instalados
- [ ] Docker configurado con NVIDIA runtime
- [ ] Ollama instances corriendo en cada GPU
- [ ] Load balancer operativo en puerto 8080
- [ ] Multi-GPU ACP Agent corriendo en puerto 8082
- [ ] Health checks pasando
- [ ] Load testing completado
- [ ] Monitoring configurado
- [ ] Backup strategy implementado
- [ ] Security hardening aplicado

## 🚀 Resultado Final

Con esta configuración tendrás:
- **18 usuarios concurrentes** (6 por GPU)
- **3,000 resumes procesados por día**
- **Load balancing automático** entre GPUs
- **Health monitoring** en tiempo real
- **Fault tolerance** con fallback a otras GPUs
- **Scalability horizontal** fácil de implementar

**¡Listo para escalar ResumeCast a nivel enterprise!** 🎯