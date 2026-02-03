# ResumeCast ACP Agent

Agente que conecta **Ollama (RTX 3090)** con **ResumeCast** via **Agent Client Protocol**.

## 🎯 Arquitectura

```
Ollama (172.16.23.127:11434) ←→ ACP Agent ←→ ResumeCast (localhost:3000)
        RTX 3090                  ⚡                    NestJS API
```

## 🚀 Inicialización

### 1. Instalar dependencias
```bash
cd acp-agent
npm install
```

### 2. Asegurar que Ollama está corriendo
```bash
# Verificar Ollama en RTX 3090
curl http://172.16.23.127:11434/api/tags

# Debe mostrar los modelos disponibles
```

### 3. Iniciar ResumeCast API
```bash
cd ../apps/api-service
npm run start:dev
```

### 4. Iniciar el ACP Agent
```bash
cd ../../acp-agent
npm start
```

## 📋 Funcionalidades

### ✅ Resume Creation
- **Input**: Información del usuario + descripción del trabajo
- **Ollama**: Genera contenido optimizado en markdown
- **ResumeCast**: Crea el resume y genera embeddings
- **Output**: Resume ID + ATS Score + keyword match

### ✅ Resume Optimization
- **Input**: Resume existente + job description
- **Ollama**: Analiza gaps y sugiere mejoras
- **ResumeCast**: Actualiza LLM context con optimizaciones
- **Output**: Sugerencias específicas + nuevo ATS score

### ✅ Job Match Analysis
- **Input**: Resume ID + job description  
- **Ollama**: Calcula compatibility percentage
- **Output**: Match score + skills matched + recommendations

## 🔌 Uso via WebSocket (ACP Protocol)

```javascript
// Conectar al ACP Agent
const ws = new WebSocket('ws://localhost:8080');

// Crear resume
ws.send(JSON.stringify({
  type: 'TOOL_CALL',
  id: 'call_001',
  tool: 'create_resume',
  params: {
    userInput: '5 años experiencia en React...',
    jobDescription: 'Senior React Developer...',
    targetRole: 'Senior Developer'
  }
}));

// Recibir respuesta
// → { type: 'TOOL_RESULT', id: 'call_001', result: {...} }
```

## 🌐 Uso via HTTP API

```bash
# Health check
curl http://localhost:3001/health

# Crear resume directamente
curl -X POST http://localhost:3001/create-resume \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "Soy desarrollador React con 3 años",
    "jobDescription": "React Developer required",
    "targetRole": "React Developer"
  }'
```

## 🧪 Testing

```bash
# Correr todos los tests
npm test

# O individualmente
node test-agent.js
```

## 📊 Monitoreo

### Health Endpoints:
- **ACP Agent**: http://localhost:3001/health
- **Ollama**: http://172.16.23.127:11434/api/tags
- **ResumeCast**: http://localhost:3000/api/health

### Logs:
- **ACP Agent**: Console output con timestamps
- **Ollama**: Logs del servidor RTX 3090
- **ResumeCast**: NestJS logs

## 🔧 Configuración

### Ollama Configuration:
```javascript
this.ollamaUrl = 'http://172.16.23.127:11434';
```

### ResumeCast Configuration:
```javascript
this.resumecastUrl = 'http://localhost:3000';
```

### ACP WebSocket Configuration:
```javascript
const wss = new WebSocketServer({ port: 8080 });
```

## 🎯 Capacidades del ACP Agent

- `resume_creation` - Crear nuevos resumes con IA
- `content_optimization` - Optimizar resumes existentes
- `job_match_analysis` - Analizar compatibilidad job-resume
- `ats_compliance_check` - Validar formato ATS
- `keyword_optimization` - Extraer y optimizar keywords

## 🚨 Troubleshooting

### Connection Issues:
```bash
# Verificar Ollama
curl http://172.16.23.127:11434/api/tags

# Verificar ResumeCast
curl http://localhost:3000/api/health

# Verificar ACP Agent
curl http://localhost:3001/health
```

### Common Errors:
- **Ollama timeout**: Verificar modelo descargado
- **ResumeCast connection**: API debe estar en puerto 3000
- **WebSocket fails**: Puerto 8080 disponible

## 🔄 Flow Completo

1. **Usuario solicita** resume para rol específico
2. **ACP Agent** recibe request via WebSocket/HTTP
3. **Ollama (RTX 3090)** genera contenido optimizado
4. **ACP Agent** procesa y estructura la respuesta
5. **ResumeCast** persiste el resume y genera embeddings
6. **Resultado** retorna con ATS score y optimizaciones

🎯 **Resultado:** Ollama + ResumeCast trabajando juntos sin que el usuario sepa de la complejidad subyacente.