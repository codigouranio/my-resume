// ResumeCast ACP Agent - Conecta Ollama con tu plataforma
const WebSocket = require('ws');
const express = require('express');
const axios = require('axios');

class ResumeCastACPAgent {
  constructor() {
    this.agentId = 'resumecast-optimizer';
    this.ollamaUrl = 'http://172.16.23.127:11434';
    this.resumecastUrl = 'http://localhost:3000';
    this.ws = null;
    this.connectedClients = new Set();
    
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        agentId: this.agentId,
        ollamaConnected: this.ollamaUrl,
        resumecastConnected: this.resumecastUrl
      });
    });

    // Endpoint directo para test rápido
    this.app.post('/create-resume', async (req, res) => {
      try {
        const { userInput, jobDescription, targetRole } = req.body;
        const result = await this.createResumeWithAI(userInput, jobDescription, targetRole);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para optimizar resume existente
    this.app.post('/optimize-resume/:resumeId', async (req, res) => {
      try {
        const { resumeId } = req.params;
        const { jobDescription } = req.body;
        const result = await this.optimizeResumeWithAI(resumeId, jobDescription);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para analizar match
    this.app.post('/analyze-match', async (req, res) => {
      try {
        const { resumeId, jobDescription } = req.body;
        const result = await this.analyzeJobMatch(resumeId, jobDescription);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async setupWebSocket() {
    const wss = new WebSocketServer({ port: 8080 });
    
    wss.on('connection', (ws, request) => {
      console.log('🔌 Client connected to ResumeCast ACP');
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
        console.log('👋 Client disconnected from ResumeCast ACP');
      });

      // Welcome message
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        agentId: this.agentId,
        capabilities: [
          'resume_creation',
          'content_optimization',
          'job_match_analysis',
          'ats_compliance_check',
          'keyword_optimization'
        ]
      }));
    });

    console.log('📡 ResumeCast ACP WebSocket server on ws://localhost:8080');
  }

  async handleACPMessage(ws, message) {
    switch (message.type) {
      case 'TOOL_CALL':
        const result = await this.executeTool(message.tool, message.params);
        ws.send(JSON.stringify({
          type: 'TOOL_RESULT',
          id: message.id,
          result
        }));
        break;

      case 'HEARTBEAT':
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'ERROR',
          error: `Unknown message type: ${message.type}`
        }));
    }
  }

  async executeTool(tool, params) {
    console.log(`🔧 Executing tool: ${tool}`, params);
    
    switch (tool) {
      case 'create_resume':
        return await this.createResumeWithAI(params.userInput, params.jobDescription, params.targetRole);
      
      case 'optimize_resume':
        return await this.optimizeResumeWithAI(params.resumeId, params.jobDescription);
      
      case 'analyze_match':
        return await this.analyzeJobMatch(params.resumeId, params.jobDescription);
      
      case 'extract_keywords':
        return await this.extractKeywordsFromJD(params.jobDescription);
      
      case 'validate_ats':
        return await this.validateATSCompliance(params.resumeId);
      
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  async createResumeWithAI(userInput, jobDescription, targetRole) {
    console.log(`🚀 Creating resume for ${targetRole}`);
    
    try {
      // 1. Generar contenido con Ollama
      const ollamaPrompt = `
      Based on this user input and job description, create a professional resume:

      USER INPUT: ${userInput}
      JOB DESCRIPTION: ${jobDescription}
      TARGET ROLE: ${targetRole}

      Create a compelling resume in markdown format that:
      1. Highlights relevant experience for this role
      2. Includes keywords from the job description
      3. Follows ATS best practices
      4. Shows quantifiable achievements

      Return only the resume content in markdown format.
      `;

      const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.1',
        prompt: ollamaPrompt,
        stream: false
      });

      const resumeContent = ollamaResponse.data.response;

      // 2. Crear resume en ResumeCast
      const resumeResponse = await axios.post(`${this.resumecastUrl}/api/resumes`, {
        title: `${targetRole} Resume`,
        content: resumeContent,
        llmContext: `Generated for ${targetRole} role based on: ${jobDescription}`,
        isPublic: false,
        isPublished: false
      });

      const resumeData = resumeResponse.data;

      // 3. Generar embedding para búsqueda
      try {
        await axios.post(`${this.resumecastUrl}/api/embeddings/generate`, {
          resumeId: resumeData.id
        });
      } catch (embeddingError) {
        console.warn('⚠️ Embedding generation failed:', embeddingError.message);
      }

      // 4. Analizar ATS compliance
      const atsScore = await this.calculateATSScore(resumeContent, jobDescription);

      return {
        success: true,
        resumeId: resumeData.id,
        resumeTitle: resumeData.title,
        atsScore,
        keywordMatch: await this.extractKeywordMatch(resumeContent, jobDescription),
        suggestions: await this.generateOptimizationSuggestions(resumeContent, jobDescription)
      };

    } catch (error) {
      console.error('❌ Error creating resume:', error.message);
      throw error;
    }
  }

  async optimizeResumeWithAI(resumeId, jobDescription) {
    console.log(`🔧 Optimizing resume ${resumeId}`);
    
    try {
      // 1. Obtener resume actual
      const resumeResponse = await axios.get(`${this.resumecastUrl}/api/resumes/${resumeId}`);
      const resume = resumeResponse.data;

      // 2. Analizar con Ollama
      const optimizationPrompt = `
      Analyze this resume and suggest improvements for the target job:

      CURRENT RESUME:
      ${resume.content}

      TARGET JOB DESCRIPTION:
      ${jobDescription}

      Provide specific suggestions for:
      1. Missing keywords from job description
      2. Weak achievements to strengthen
      3. Better action verbs
      4. ATS formatting improvements
      5. Skills to highlight

      Return suggestions as JSON format.
      `;

      const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.1',
        prompt: optimizationPrompt,
        stream: false
      });

      const suggestions = ollamaResponse.data.response;

      // 3. Actualizar LLM context en ResumeCast
      await axios.patch(`${this.resumecastUrl}/api/resumes/${resumeId}`, {
        llmContext: `Last optimization: ${new Date().toISOString()}\nTarget job: ${jobDescription}\nSuggestions: ${suggestions}`
      });

      return {
        success: true,
        resumeId,
        suggestions,
        optimizedAt: new Date().toISOString(),
        atsScore: await this.calculateATSScore(resume.content, jobDescription)
      };

    } catch (error) {
      console.error('❌ Error optimizing resume:', error.message);
      throw error;
    }
  }

  async analyzeJobMatch(resumeId, jobDescription) {
    try {
      const resumeResponse = await axios.get(`${this.resumecastUrl}/api/resumes/${resumeId}`);
      const resume = resumeResponse.data;

      const matchPrompt = `
      Calculate match percentage between this resume and job:

      RESUME:
      ${resume.content}

      JOB DESCRIPTION:
      ${jobDescription}

      Analyze and return:
      1. Overall match percentage (0-100)
      2. Skills matched vs missing
      3. Experience alignment score
      4. Recommendations to improve match

      Return as JSON.
      `;

      const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.1',
        prompt: matchPrompt,
        stream: false
      });

      const analysis = ollamaResponse.data.response;

      return {
        resumeId,
        jobDescription,
        analysis,
        analyzedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error analyzing match:', error.message);
      throw error;
    }
  }

  async calculateATSScore(resumeContent, jobDescription) {
    // Simplified ATS scoring - puedes mejorar esto
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

  async extractKeywordMatch(resumeContent, jobDescription) {
    const jobKeywords = jobDescription.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const resumeLower = resumeContent.toLowerCase();
    
    const matched = jobKeywords.filter(keyword => resumeLower.includes(keyword));
    const missing = jobKeywords.filter(keyword => !resumeLower.includes(keyword));

    return {
      matched,
      missing,
      matchPercentage: Math.round((matched.length / jobKeywords.length) * 100)
    };
  }

  async generateOptimizationSuggestions(resumeContent, jobDescription) {
    // Extraer suggestions generales
    const suggestions = [];
    
    if (resumeContent.length < 500) {
      suggestions.push("Consider adding more detail to your experience section");
    }
    
    if (!resumeContent.match(/\d+%/g)) {
      suggestions.push("Include quantifiable achievements with percentages");
    }

    return suggestions;
  }

  start() {
    // Iniciar servidor HTTP y WebSocket
    this.app.listen(3001, () => {
      console.log('🚀 ResumeCast ACP Agent HTTP server on http://localhost:3001');
      console.log('📋 Health check: http://localhost:3001/health');
    });

    this.setupWebSocket();
  }
}

// Iniciar el ACP Agent
const agent = new ResumeCastACPAgent();
agent.start();

console.log('🎯 ResumeCast ACP Agent started!');
console.log('🔗 Connecting Ollama at http://172.16.23.127:11434');
console.log('🔗 Connecting ResumeCast at http://localhost:3000');