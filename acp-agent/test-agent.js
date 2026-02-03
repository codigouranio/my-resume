// Test client para probar el ACP Agent
const WebSocket = require('ws');
const axios = require('axios');

class ACPTestClient {
  constructor() {
    this.ws = null;
    this.pendingCalls = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:8080');
      
      this.ws.onopen = () => {
        console.log('🔌 Connected to ResumeCast ACP Agent');
        resolve();
      };
      
      this.ws.onerror = reject;
      this.setupMessageHandling();
    });
  }

  setupMessageHandling() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'CONNECTED':
          console.log('✅ Agent capabilities:', message.capabilities);
          break;
          
        case 'TOOL_RESULT':
          const pending = this.pendingCalls.get(message.id);
          if (pending) {
            pending.resolve(message.result);
            this.pendingCalls.delete(message.id);
          }
          break;
          
        case 'ERROR':
          console.error('❌ Error from agent:', message.error);
          break;
      }
    };
  }

  async callTool(tool, params) {
    return new Promise((resolve, reject) => {
      const callId = `test_${Date.now()}_${Math.random()}`;
      
      this.pendingCalls.set(callId, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        type: 'TOOL_CALL',
        id: callId,
        tool: tool,
        params: params
      }));
      
      setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId);
          reject(new Error('Tool call timeout'));
        }
      }, 30000);
    });
  }
}

async function testResumeCreation() {
  const client = new ACPTestClient();
  
  try {
    await client.connect();
    console.log('🧪 Testing resume creation...');
    
    const result = await client.callTool('create_resume', {
      userInput: 'Tengo 5 años de experiencia en React y Node.js. Trabajé en 3 proyectos importantes donde mejoré el rendimiento 40%. Sé TypeScript, Python y cloud.',
      jobDescription: 'Senior Software Engineer at Google - requires 5+ years React, Node.js, TypeScript, cloud experience. Must have experience with large-scale systems and performance optimization.',
      targetRole: 'Senior Software Engineer'
    });
    
    console.log('✅ Resume creation result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Test optimization
    if (result.success && result.resumeId) {
      console.log('\n🔧 Testing resume optimization...');
      
      const optimizationResult = await client.callTool('optimize_resume', {
        resumeId: result.resumeId,
        jobDescription: 'Senior Software Engineer at Google - requires React, Node.js, TypeScript, cloud experience'
      });
      
      console.log('✅ Optimization result:');
      console.log(JSON.stringify(optimizationResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testHTTPAPI() {
  console.log('🌐 Testing HTTP API...');
  
  try {
    // Test health
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check:', healthResponse.data);
    
    // Test direct resume creation
    const resumeResponse = await axios.post('http://localhost:3001/create-resume', {
      userInput: 'Soy desarrollador full-stack con experiencia en React, Node.js y AWS.',
      jobDescription: 'Full Stack Developer - React, Node.js, AWS required',
      targetRole: 'Full Stack Developer'
    });
    
    console.log('✅ Direct resume creation:');
    console.log(JSON.stringify(resumeResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ HTTP API test failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting ResumeCast ACP Agent tests...\n');
  
  // Test 1: HTTP API
  await testHTTPAPI();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: WebSocket ACP
  await testResumeCreation();
  
  console.log('\n🎉 All tests completed!');
}

runTests();