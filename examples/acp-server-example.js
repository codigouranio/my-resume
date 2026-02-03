// Ejemplo de Agent Client Protocol en acción
// Este sería un ACP server que coordina múltiples agentes

const express = require('express');
const { WebSocketServer } = require('ws');

class ACPServer {
  constructor() {
    this.app = express();
    this.agents = new Map(); // agentes conectados
    this.tools = new Map();  // herramientas disponibles
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    // Agent registration
    this.app.post('/acp/agents/register', (req, res) => {
      const { agentId, capabilities } = req.body;
      this.agents.set(agentId, {
        id: agentId,
        capabilities,
        status: 'active',
        lastSeen: new Date()
      });
      res.json({ success: true, agentId });
    });

    // Tool registration  
    this.app.post('/acp/tools/register', (req, res) => {
      const { toolId, description, endpoint } = req.body;
      this.tools.set(toolId, { description, endpoint });
      res.json({ success: true, toolId });
    });

    // Agent task execution
    this.app.post('/acp/agents/:agentId/execute', async (req, res) => {
      const { tool, parameters } = req.body;
      
      // 1. Validate agent has permission
      if (!this.agents.has(req.params.agentId)) {
        return res.status(403).json({ error: 'Agent not registered' });
      }

      // 2. Execute tool via ACP
      try {
        const result = await this.executeTool(tool, parameters);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSocket() {
    const wss = new WebSocketServer({ port: 8080 });
    
    wss.on('connection', (ws, request) => {
      console.log('🔌 Agent connected via ACP');
      
      // ACP message format
      ws.on('message', async (data) => {
        const message = JSON.parse(data);
        
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
        }
      });
    });
  }

  async executeTool(toolId, params) {
    // Execute tools that are available in the current environment
    switch (toolId) {
      case 'bash':
        return this.executeBash(params.command);
      case 'read':
        return this.readFile(params.path);
      case 'write':
        return this.writeFile(params.path, params.content);
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  async executeBash(command) {
    const { execSync } = require('child_process');
    return execSync(command, { encoding: 'utf8' });
  }

  async readFile(path) {
    const fs = require('fs').promises;
    return await fs.readFile(path, 'utf8');
  }

  async writeFile(path, content) {
    const fs = require('fs').promises;
    await fs.writeFile(path, content);
    return { success: true };
  }
}

// Iniciar ACP server
const acpServer = new ACPServer();
acpServer.app.listen(3000, () => {
  console.log('🚀 ACP Server running on port 3000');
  console.log('📡 WebSocket ACP on ws://localhost:8080');
});