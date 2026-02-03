// Multi-GPU ACP Agent con Load Balancing
const WebSocket = require('ws');
const express = require('express');
const axios = require('axios');

class MultiGPUACPAgent {
  constructor() {
    this.agentId = 'resumecast-multigpu';
    
    // Configuración de 3 GPUs
    this.gpuEndpoints = [
      { id: 0, url: 'http://172.16.23.127:11434', load: 0, requests: 0 },
      { id: 1, url: 'http://172.16.23.127:11435', load: 0, requests: 0 },
      { id: 2, url: 'http://172.16.23.127:11436', load: 0, requests: 0 }
    ];
    
    this.loadBalancerPort = 8080;
    this.ws = null;
    this.connectedClients = new Set();
    
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check completo
    this.app.get('/health', async (req, res) => {
      const gpuStatuses = await Promise.all(
        this.gpuEndpoints.map(async (gpu) => {
          try {
            const response = await axios.get(`${gpu.url}/api/tags`, { timeout: 2000 });
            return {
              id: gpu.id,
              url: gpu.url,
              status: 'healthy',
              models: response.data.models || [],
              load: gpu.load,
              requests: gpu.requests
            };
          } catch (error) {
            return {
              id: gpu.id,
              url: gpu.url,
              status: 'unhealthy',
              error: error.message,
              load: gpu.load,
              requests: gpu.requests
            };
          }
        })
      );

      res.json({
        agentId: this.agentId,
        totalGPUs: this.gpuEndpoints.length,
        healthyGPUs: gpuStatuses.filter(g => g.status === 'healthy').length,
        gpuStatuses,
        totalCapacity: gpuStatuses.filter(g => g.status === 'healthy').length * 6, // 6 users per GPU
        currentLoad: this.gpuEndpoints.reduce((sum, gpu) => sum + gpu.load, 0)
      });
    });

    // Endpoint unificado (con load balancing)
    this.app.post('/api/generate', async (req, res) => {
      try {
        const result = await this.generateWithLoadBalancing(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Resume creation con multi-GPU
    this.app.post('/create-resume', async (req, res) => {
      try {
        const { userInput, jobDescription, targetRole } = req.body;
        const result = await this.createResumeWithMultiGPU(userInput, jobDescription, targetRole);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bulk resume processing (para enterprise)
    this.app.post('/bulk-process', async (req, res) => {
      try {
        const { resumes } = req.body;
        const results = await this.processBulkResumes(resumes);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Monitoring endpoint
    this.app.get('/monitor', (req, res) => {
      const monitoring = {
        timestamp: new Date().toISOString(),
        endpoints: this.gpuEndpoints,
        totalRequests: this.gpuEndpoints.reduce((sum, gpu) => sum + gpu.requests, 0),
        currentLoad: this.gpuEndpoints.reduce((sum, gpu) => sum + gpu.load, 0),
        averageResponseTime: this.getAverageResponseTime()
      };
      res.json(monitoring);
    });
  }

  async setupWebSocket() {
    const wss = new WebSocketServer({ port: 8081 });
    
    wss.on('connection', (ws, request) => {
      console.log('🔌 Client connected to Multi-GPU ACP Agent');
      this.connectedClients.add(ws);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleACPMessage(ws, message);
        } catch (error) {
          console.error('❌ Error handling ACP message:', error);
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: error.message
          }));
        }
      });

      ws.on('close', () => {
        this.connectedClients.delete(ws);
        console.log('👋 Client disconnected from Multi-GPU ACP Agent');
      });

      // Welcome message con capacidades multi-GPU
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        agentId: this.agentId,
        capabilities: [
          'resume_creation',
          'content_optimization', 
          'job_match_analysis',
          'bulk_processing',
          'load_balancing',
          'gpu_monitoring'
        ],
        gpuCount: this.gpuEndpoints.length,
        maxConcurrentUsers: this.gpuEndpoints.length * 6
      }));
    });

    console.log('📡 Multi-GPU ACP WebSocket on ws://localhost:8081');
  }

  async handleACPMessage(ws, message) {
    switch (message.type) {
      case 'TOOL_CALL':
        const result = await this.executeToolWithLoadBalancing(message.tool, message.params);
        ws.send(JSON.stringify({
          type: 'TOOL_RESULT',
          id: message.id,
          result
        }));
        break;

      case 'HEARTBEAT':
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;
    }
  }

  async executeToolWithLoadBalancing(tool, params) {
    console.log(`🔧 Executing tool with load balancing: ${tool}`, params);
    
    switch (tool) {
      case 'create_resume':
        return await this.createResumeWithMultiGPU(params.userInput, params.jobDescription, params.targetRole);
      case 'optimize_resume':
        return await this.optimizeResumeWithMultiGPU(params.resumeId, params.jobDescription);
      case 'analyze_match':
        return await this.analyzeJobMatchMultiGPU(params.resumeId, params.jobDescription);
      case 'bulk_create':
        return await this.processBulkResumes(params.resumes);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  async generateWithLoadBalancing(promptData) {
    // Encontrar GPU con menor carga
    const selectedGPU = this.findLeastBusyGPU();
    
    // Incrementar carga
    selectedGPU.load++;
    selectedGPU.requests++;
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${selectedGPU.url}/api/generate`, {
        ...promptData,
        model: promptData.model || 'gemma2:9b'
      }, {
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      
      // Actualizar estadísticas
      selectedGPU.responseTimes = selectedGPU.responseTimes || [];
      selectedGPU.responseTimes.push(responseTime);
      if (selectedGPU.responseTimes.length > 100) {
        selectedGPU.responseTimes = selectedGPU.responseTimes.slice(-100);
      }
      
      console.log(`✅ Request completed on GPU ${selectedGPU.id} in ${responseTime}ms`);
      
      return {
        ...response.data,
        gpuId: selectedGPU.id,
        responseTime,
        loadBalancer: 'multi-gpu'
      };
      
    } catch (error) {
      console.error(`❌ Error on GPU ${selectedGPU.id}:`, error.message);
      
      // Reintentar con otro GPU
      const fallbackGPU = this.findLeastBusyGPU(selectedGPU.id);
      if (fallbackGPU && fallbackGPU.id !== selectedGPU.id) {
        console.log(`🔄 Retrying on GPU ${fallbackGPU.id}`);
        return await this.generateWithLoadBalancing(promptData);
      }
      
      throw error;
    } finally {
      selectedGPU.load--;
    }
  }

  findLeastBusyGPU(excludeId = null) {
    let leastBusy = null;
    let minLoad = Infinity;
    
    for (const gpu of this.gpuEndpoints) {
      if (gpu.id === excludeId) continue;
      
      // Simple heuristic: current load + request count
      const effectiveLoad = gpu.load + (gpu.requests * 0.1);
      
      if (effectiveLoad < minLoad) {
        minLoad = effectiveLoad;
        leastBusy = gpu;
      }
    }
    
    return leastBusy;
  }

  async createResumeWithMultiGPU(userInput, jobDescription, targetRole) {
    console.log(`🚀 Creating resume with multi-GPU for ${targetRole}`);
    
    try {
      // 1. Usar GPU con menor carga para generación
      const gpu = this.findLeastBusyGPU();
      gpu.load++;
      
      const prompt = `
      Based on this user input and job description, create a professional resume:

      USER INPUT: ${userInput}
      JOB DESCRIPTION: ${jobDescription}
      TARGET ROLE: ${targetRole}

      Create a compelling resume in markdown format that:
      1. Highlights relevant experience for this role
      2. Includes keywords from job description
      3. Follows ATS best practices
      4. Shows quantifiable achievements

      Return only resume content in markdown format.
      `;

      const response = await axios.post(`${gpu.url}/api/generate`, {
        model: 'gemma2:9b',
        prompt: prompt,
        stream: false
      });

      gpu.load--;
      const resumeContent = response.data.response;

      // 2. Crear resume en ResumeCast
      const resumeResponse = await axios.post('http://localhost:3000/api/resumes', {
        title: `${targetRole} Resume`,
        content: resumeContent,
        llmContext: `Generated for ${targetRole} role on GPU ${gpu.id}`,
        isPublic: false,
        isPublished: false
      });

      const resumeData = resumeResponse.data;

      // 3. Generar embedding (puede usar otro GPU)
      try {
        await axios.post('http://localhost:3000/api/embeddings/generate', {
          resumeId: resumeData.id
        });
      } catch (embeddingError) {
        console.warn('⚠️ Embedding generation failed:', embeddingError.message);
      }

      return {
        success: true,
        resumeId: resumeData.id,
        resumeTitle: resumeData.title,
        processedByGPU: gpu.id,
        gpuLoad: gpu.load,
        atsScore: await this.calculateATSScore(resumeContent, jobDescription)
      };

    } catch (error) {
      console.error('❌ Error creating resume with multi-GPU:', error.message);
      throw error;
    }
  }

  async processBulkResumes(resumes) {
    console.log(`📦 Processing bulk resumes: ${resumes.length} items`);
    
    // Distribuir resumes entre GPUs disponibles
    const promises = resumes.map(async (resume, index) => {
      const gpu = this.findLeastBusyGPU();
      return await this.createResumeWithMultiGPU(
        resume.userInput,
        resume.jobDescription,
        resume.targetRole
      );
    });

    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);

    return {
      total: resumes.length,
      successful: successful.length,
      failed: failed.length,
      results: successful,
      errors: failed
    };
  }

  getAverageResponseTime() {
    const allTimes = this.gpuEndpoints
      .filter(gpu => gpu.responseTimes && gpu.responseTimes.length > 0)
      .flatMap(gpu => gpu.responseTimes);
    
    if (allTimes.length === 0) return 0;
    
    const sum = allTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / allTimes.length);
  }

  async calculateATSScore(resumeContent, jobDescription) {
    // Simplified ATS scoring
    const jobKeywords = jobDescription.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const resumeLower = resumeContent.toLowerCase();
    
    let matches = 0;
    jobKeywords.forEach(keyword => {
      if (resumeLower.includes(keyword)) matches++;
    });

    return {
      score: Math.round((matches / jobKeywords.length) * 100),
      matchedKeywords: matches,
      totalKeywords: jobKeywords.length
    };
  }

  start() {
    // Iniciar servidor HTTP
    this.app.listen(8082, () => {
      console.log('🚀 Multi-GPU ACP Agent on http://localhost:8082');
      console.log('📋 Health check: http://localhost:8082/health');
      console.log('📊 Monitoring: http://localhost:8082/monitor');
    });

    // Iniciar WebSocket
    this.setupWebSocket();
    
    // Iniciar health check loop
    setInterval(() => {
      this.healthCheck();
    }, 30000); // Check every 30 seconds
  }

  async healthCheck() {
    for (const gpu of this.gpuEndpoints) {
      try {
        await axios.get(`${gpu.url}/api/tags`, { timeout: 2000 });
        gpu.healthy = true;
      } catch (error) {
        gpu.healthy = false;
        console.warn(`⚠️ GPU ${gpu.id} unhealthy: ${error.message}`);
      }
    }
  }
}

// Iniciar el Multi-GPU ACP Agent
const agent = new MultiGPUACPAgent();
agent.start();

console.log('🎯 Multi-GPU ResumeCast ACP Agent started!');
console.log('🔗 Managing 3 GPUs: 172.16.23.127:11434-11436');
console.log('📈 Capacity: 18 concurrent users, ~3,000 resumes/day');