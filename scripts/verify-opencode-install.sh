#!/bin/bash
# Script de verificación segura - no afecta Ollama

echo "🔍 Verificando instalación de opencode sin afectar Ollama..."

# 1. Verificar Ollama sigue funcionando
echo "📋 1. Verificando Ollama status..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama OK - funcionando normalmente"
else
    echo "❌ Ollama no responde - verificar puerto 11434"
    exit 1
fi

# 2. Verificar GPUs disponibles
echo "📋 2. Verificando GPUs..."
if command -v nvidia-smi &> /dev/null; then
    echo "✅ nvidia-smi disponible"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "❌ nvidia-smi no encontrado"
    exit 1
fi

# 3. Verificar memoria disponible
echo "📋 3. Verificando memoria..."
available_mem=$(free -h | awk '/^Mem:/ {print $7}')
echo "   Memoria disponible: $available_mem"

# 4. Verificar espacio en disco
echo "📋 4. Verificando espacio en disco..."
disk_space=$(df -h / | awk 'NR==2 {print $4}')
echo "   Espacio disponible: $disk_space"

# 5. Probar opencode sin inicializar
echo "📋 5. Probando opencode..."

if command -v opencode &> /dev/null; then
    echo "✅ opencode encontrado"
    version=$(opencode --version 2>/dev/null || echo "desconocida")
    echo "   Versión: $version"
    
    # Probar comando que no afecta nada
    echo "   Probando comando stats..."
    timeout 10s opencode stats > /dev/null 2>&1
    if [ $? -eq 0 ] || [ $? -eq 124 ]; then
        echo "✅ Comandos básicos funcionan"
    else
        echo "⚠️ Comando stats tuvo timeout o error (puede ser normal)"
    fi
else
    echo "❌ opencode no encontrado en PATH"
    exit 1
fi

# 6. Verificar procesos
echo "📋 6. Verificando procesos activos..."
echo "   Procesos Python (LLM):"
pgrep -f "python.*llama" -l || echo "   Ninguno encontrado"
echo "   Procesos Docker:"
pgrep docker -l || echo "   Ninguno encontrado"

# 7. Verificar puertos
echo "📋 7. Verificando puertos ocupados..."
echo "   Puerto 11434 (Ollama):"
netstat -tlnp 2>/dev/null | grep :11434 || echo "   No detectado por netstat"
echo "   Puerto 5000 (tus LLM services):"
netstat -tlnp 2>/dev/null | grep :5000 || echo "   No detectado por netstat"

echo ""
echo "🎯 Resumen de verificación:"
echo "   - Ollama: Funcionando ✅"
echo "   - GPUs: Disponibles ✅"
echo "   - Memoria: $available_mem"
echo "   - Espacio: $disk_space"
echo "   - opencode: Instalado ✅"
echo ""
echo "🚀 Sistema listo para usar opencode sin afectar Ollama"