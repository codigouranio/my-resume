// Cliente ACP (Agent) - Así se conectaría un agente de IA
class ACPAgent {
  constructor(agentId, capabilities) {
    this.agentId = agentId;
    this.capabilities = capabilities;
    this.ws = null;
    this.pendingCalls = new Map();
  }

  async connect(serverUrl = 'ws://localhost:8080') {
    this.ws = new WebSocket(serverUrl);
    
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => {
        console.log(`🤖 Agent ${this.agentId} connected to ACP`);
        resolve();
      };
      
      this.ws.onerror = reject;
      this.setupMessageHandling();
    });
  }

  async registerToServer(serverUrl = 'http://localhost:3000') {
    const response = await fetch(`${serverUrl}/acp/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.agentId,
        capabilities: this.capabilities
      })
    });
    
    return response.json();
  }

  setupMessageHandling() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'TOOL_RESULT':
          // Resolver Promise del tool call
          const pending = this.pendingCalls.get(message.id);
          if (pending) {
            pending.resolve(message.result);
            this.pendingCalls.delete(message.id);
          }
          break;
          
        case 'PONG':
          // Heartbeat response
          break;
      }
    };
  }

  async callTool(toolName, parameters) {
    return new Promise((resolve, reject) => {
      const callId = `call_${Date.now()}_${Math.random()}`;
      
      // Guardar Promise para resolver cuando llegue el resultado
      this.pendingCalls.set(callId, { resolve, reject });
      
      // Enviar tool call via ACP
      this.ws.send(JSON.stringify({
        type: 'TOOL_CALL',
        id: callId,
        tool: toolName,
        params: parameters
      }));
      
      // Timeout después de 30 segundos
      setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId);
          reject(new Error('Tool call timeout'));
        }
      }, 30000);
    });
  }
}

// Ejemplo de uso: Un agente de IA que puede leer archivos y ejecutar comandos
async function createAIAgent() {
  const aiAgent = new ACPAgent('gpt-coder', [
    'file_operations',
    'bash_execution', 
    'web_search',
    'database_query'
  ]);

  await aiAgent.connect();
  await aiAgent.registerToServer();
  
  console.log('🤖 AI Agent ready for tasks!');
  
  // El agente puede ahora usar herramientas:
  try {
    const fileContent = await aiAgent.callTool('read', { 
      path: '/path/to/important/file' 
    });
    console.log('📄 File content:', fileContent);
    
    const result = await aiAgent.callTool('bash', {
      command: 'ls -la /path/to/directory'
    });
    console.log('🖥️ Directory listing:', result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createAIAgent();