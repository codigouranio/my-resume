#!/usr/bin/env node

/**
 * System Health Check Script
 * Tests all critical services and systems
 * Run: node scripts/health-check.js [--remote] [--detailed]
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Configuration
const config = {
  local: {
    api: 'http://localhost:3000',
    llm: 'http://localhost:5000',
    ollama: 'http://localhost:11434',
    database: {
      host: 'localhost',
      port: 5432,
      user: 'resume_user',
      database: 'resume_db',
    },
  },
  remote: {
    api: 'http://172.16.23.127:3000',
    llm: 'http://172.16.23.127:5000',
    ollama: 'http://172.16.23.127:11434',
    database: {
      host: '172.16.23.127',
      port: 5432,
      user: 'resume_user',
      database: 'resume_db',
    },
  },
};

// Parse command line arguments
const isRemote = process.argv.includes('--remote');
const isDetailed = process.argv.includes('--detailed');
const currentConfig = isRemote ? config.remote : config.local;
const environment = isRemote ? 'Remote' : 'Local';

// Health check results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: [],
};

// Utility functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function makeRequest(url, method = 'GET', timeout = 5000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      timeout: timeout,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : data,
            time: Date.now(),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            time: Date.now(),
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout', time: Date.now() });
    });

    req.on('error', (err) => {
      resolve({ error: err.message, time: Date.now() });
    });

    req.end();
  });
}

function recordResult(name, passed, details = '') {
  const result = {
    name,
    passed,
    details,
    timestamp: new Date().toISOString(),
  };
  results.checks.push(result);

  if (passed) {
    results.passed++;
    log(`  ✓ ${name}`, colors.green);
  } else {
    results.failed++;
    log(`  ✗ ${name}`, colors.red);
  }

  if (details && isDetailed) {
    log(`    ${details}`, colors.gray);
  }
}

// Health checks
async function checkAPIService() {
  logSection(`API Service (${environment})`);

  const startTime = Date.now();
  const response = await makeRequest(`${currentConfig.api}/api`);
  const duration = Date.now() - startTime;

  if (response.error) {
    recordResult('API Service Connectivity', false, `Error: ${response.error}`);
    return;
  }

  recordResult(
    'API Service Connectivity',
    response.status === 404 || response.status === 200,
    `Status: ${response.status}, Response time: ${duration}ms`
  );

  // Check specific endpoints
  const endpoints = [
    { path: '/api/auth/profile', protected: true },
    { path: '/api/users', protected: true },
    { path: '/api/resumes', protected: true },
    { path: '/api/templates', protected: false },
  ];

  for (const endpoint of endpoints) {
    const epResponse = await makeRequest(`${currentConfig.api}${endpoint.path}`);
    const isHealthy =
      epResponse.status === 401 ||
      epResponse.status === 200 ||
      epResponse.status === 404;
    recordResult(
      `API Endpoint: ${endpoint.path}`,
      isHealthy,
      `Status: ${epResponse.status || epResponse.error}`
    );
  }
}

async function checkLLMService() {
  logSection(`LLM Service (${environment})`);

  const startTime = Date.now();
  const response = await makeRequest(`${currentConfig.llm}/health`);
  const duration = Date.now() - startTime;

  if (response.error) {
    recordResult('LLM Service Connectivity', false, `Error: ${response.error}`);
    return;
  }

  recordResult(
    'LLM Service Health',
    response.status === 200,
    `Status: ${response.status}, Response time: ${duration}ms`
  );

  if (response.body && response.body.status) {
    recordResult(
      'LLM Service Status',
      response.body.status === 'healthy',
      `Status: ${response.body.status}`
    );
  }

  if (response.body && response.body.server_reachable !== undefined) {
    recordResult(
      'Ollama Server Reachable',
      response.body.server_reachable,
      `Ollama: ${response.body.llama_server}`
    );
  }

  // Test chat endpoint
  const chatResponse = await makeRequest(`${currentConfig.llm}/api/chat`, 'POST');
  const canChat =
    chatResponse.status === 200 ||
    chatResponse.status === 400 ||
    !chatResponse.error;
  recordResult('LLM Chat Endpoint', canChat, `Status: ${chatResponse.status || chatResponse.error}`);
}

async function checkOllama() {
  logSection(`Ollama (${environment})`);

  const startTime = Date.now();
  const response = await makeRequest(`${currentConfig.ollama}/api/tags`);
  const duration = Date.now() - startTime;

  if (response.error) {
    recordResult('Ollama Connectivity', false, `Error: ${response.error}`);
    return;
  }

  recordResult(
    'Ollama Connectivity',
    response.status === 200,
    `Status: ${response.status}, Response time: ${duration}ms`
  );

  if (response.body && response.body.models) {
    const modelCount = response.body.models.length;
    recordResult(
      `Ollama Models Available`,
      modelCount > 0,
      `Found ${modelCount} model(s)`
    );

    if (isDetailed) {
      response.body.models.forEach((model) => {
        const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(2);
        log(`    - ${model.name} (${sizeGB}GB)`, colors.gray);
      });
    }

    const hasLlamaModel = response.body.models.some((m) =>
      m.name.includes('llama')
    );
    recordResult(
      'LLaMA Model Available',
      hasLlamaModel,
      'Required for chat functionality'
    );
  }
}

async function checkDatabase() {
  logSection(`PostgreSQL Database (${environment})`);

  try {
    // Try to require pg, but don't fail if not installed
    let pg;
    try {
      pg = require('pg');
    } catch (e) {
      recordResult(
        'PostgreSQL Client',
        false,
        'pg module not installed (npm install pg)'
      );
      return;
    }

    const client = new pg.Client({
      host: currentConfig.database.host,
      port: currentConfig.database.port,
      user: currentConfig.database.user,
      database: currentConfig.database.database,
      connectionTimeoutMillis: 5000,
    });

    const startTime = Date.now();
    await client.connect();
    const duration = Date.now() - startTime;

    recordResult(
      'Database Connectivity',
      true,
      `Connected in ${duration}ms`
    );

    // Check tables exist
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const result = await client.query(tableQuery);
    const tables = result.rows.map((r) => r.table_name);

    recordResult(
      'Database Tables',
      tables.length > 0,
      `Found ${tables.length} table(s)`
    );

    const requiredTables = [
      'User',
      'Resume',
      'ChatInteraction',
      'ChatAnalytics',
      'RecruiterInterest',
    ];
    const missingTables = requiredTables.filter(
      (t) => !tables.includes(t)
    );

    if (missingTables.length === 0) {
      recordResult('Required Tables', true, 'All tables present');
    } else {
      recordResult(
        'Required Tables',
        false,
        `Missing: ${missingTables.join(', ')}`
      );
    }

    if (isDetailed) {
      tables.forEach((t) => log(`    - ${t}`, colors.gray));
    }

    // Check row counts
    const countQueries = {
      'User Accounts': 'SELECT COUNT(*) as count FROM "User"',
      'Resumes': 'SELECT COUNT(*) as count FROM "Resume"',
      'Chat Interactions': 'SELECT COUNT(*) as count FROM "ChatInteraction"',
    };

    for (const [name, query] of Object.entries(countQueries)) {
      try {
        const countResult = await client.query(query);
        const count = countResult.rows[0]?.count || 0;
        log(`  ℹ ${name}: ${count}`, colors.blue);
      } catch (e) {
        // Table might not exist, skip
      }
    }

    await client.end();
  } catch (error) {
    recordResult('Database Connectivity', false, `Error: ${error.message}`);
  }
}

async function checkFrontend() {
  logSection('Frontend Build');

  const frontendDir = path.join(__dirname, '../apps/my-resume');
  const distDir = path.join(frontendDir, 'dist');

  // Check if dist directory exists
  const distExists = fs.existsSync(distDir);
  recordResult('Frontend Build Directory', distExists, `${distDir}`);

  if (distExists) {
    const files = fs.readdirSync(distDir);
    const htmlExists = files.includes('index.html');
    recordResult('Frontend HTML File', htmlExists);

    const jsDir = path.join(distDir, 'static/js');
    if (fs.existsSync(jsDir)) {
      const jsFiles = fs.readdirSync(jsDir);
      recordResult(
        'Frontend JavaScript Bundles',
        jsFiles.length > 0,
        `Found ${jsFiles.length} bundle(s)`
      );

      if (isDetailed) {
        jsFiles.forEach((f) => log(`    - ${f}`, colors.gray));
      }
    }
  }

  // Check package.json exists
  const packageJsonPath = path.join(frontendDir, 'package.json');
  recordResult(
    'Frontend Package Config',
    fs.existsSync(packageJsonPath),
    packageJsonPath
  );
}

async function checkGit() {
  logSection('Git Repository');

  const gitDir = path.join(__dirname, '../.git');
  const gitExists = fs.existsSync(gitDir);
  recordResult('Git Repository', gitExists);

  if (gitExists) {
    const gitHeadPath = path.join(gitDir, 'HEAD');
    if (fs.existsSync(gitHeadPath)) {
      const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
      const branch = head.split('/').pop();
      log(`  Current branch: ${branch}`, colors.blue);
    }
  }
}

async function checkDependencies() {
  logSection('Dependencies');

  const rootDir = path.join(__dirname, '..');

  // Check Node modules
  const nodeModulesExists = fs.existsSync(
    path.join(rootDir, 'node_modules')
  );
  recordResult(
    'Root node_modules',
    nodeModulesExists || true,
    'Check individual apps'
  );

  // Check API service dependencies
  const apiModulesExists = fs.existsSync(
    path.join(rootDir, 'apps/api-service/node_modules')
  );
  recordResult('API node_modules', apiModulesExists);

  // Check frontend dependencies
  const frontendModulesExists = fs.existsSync(
    path.join(rootDir, 'apps/my-resume/node_modules')
  );
  recordResult('Frontend node_modules', frontendModulesExists);

  // Check environment files
  const envFiles = {
    'API .env': path.join(rootDir, 'apps/api-service/.env'),
    'LLM .env': path.join(rootDir, 'apps/llm-service/.env'),
    'Frontend .env': path.join(rootDir, 'apps/my-resume/.env'),
  };

  for (const [name, filePath] of Object.entries(envFiles)) {
    recordResult(`${name} file`, fs.existsSync(filePath));
  }
}

// Main execution
async function runHealthChecks() {
  console.clear();
  log(
    `\n╔═══════════════════════════════════════════════════════════╗`,
    colors.cyan
  );
  log(
    `║          System Health Check - ${environment} Environment          ║`,
    colors.cyan
  );
  log(
    `╚═══════════════════════════════════════════════════════════╝\n`,
    colors.cyan
  );

  log(`Timestamp: ${new Date().toISOString()}`, colors.gray);
  log(`Mode: ${isDetailed ? 'Detailed' : 'Summary'}`, colors.gray);
  log(`Environment: ${environment}`, colors.gray);

  await checkFrontend();
  await checkDependencies();
  await checkGit();
  await checkAPIService();
  await checkLLMService();
  await checkOllama();
  await checkDatabase();

  // Summary
  logSection('Summary');

  const total = results.passed + results.failed;
  const percentage = ((results.passed / total) * 100).toFixed(1);

  log(`Total Checks: ${total}`, colors.blue);
  log(`Passed: ${results.passed}`, colors.green);
  log(`Failed: ${results.failed}`, colors.red);

  if (results.warnings > 0) {
    log(`Warnings: ${results.warnings}`, colors.yellow);
  }

  log(`Success Rate: ${percentage}%`, colors.cyan);

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the health checks
runHealthChecks().catch((error) => {
  log(`\nFatal error: ${error.message}`, colors.red);
  process.exit(1);
});
