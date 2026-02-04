const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const homeDir = os.homedir();
const logDir = path.join(homeDir, ".pm2/logs");

app.use(express.static(path.join(__dirname, "public")));

// API endpoint to get logs
app.get("/api/logs/:service", (req, res) => {
  const { service } = req.params;
  const { lines = 200, instance = "0" } = req.query;

  const logFile = path.join(logDir, `${service}-out-${instance}.log`);

  try {
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: `Log file not found: ${logFile}` });
    }

    const data = fs.readFileSync(logFile, "utf8");
    const logLines = data.split("\n").slice(-parseInt(lines));

    res.json({
      service,
      instance,
      logFile,
      totalLines: data.split("\n").length,
      logs: logLines.map((line) => ({
        text: line,
        timestamp: extractTimestamp(line),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to list available services
app.get("/api/services", (req, res) => {
  try {
    const files = fs.readdirSync(logDir);
    const services = {};

    files.forEach((file) => {
      if (file.endsWith("-out-0.log")) {
        const serviceName = file.replace("-out-0.log", "");
        services[serviceName] = true;
      }
    });

    res.json({ services: Object.keys(services) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function extractTimestamp(line) {
  const match = line.match(/(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}\s[AP]M)/);
  return match ? match[1] : null;
}

// HTML dashboard
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Service Logs</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Monaco', 'Menlo', monospace;
          background: #0d1117;
          color: #c9d1d9;
          padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #30363d;
          padding-bottom: 15px;
        }
        h1 { font-size: 24px; }
        .controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        select, input, button {
          padding: 8px 12px;
          background: #161b22;
          color: #c9d1d9;
          border: 1px solid #30363d;
          border-radius: 6px;
          font-family: monospace;
          cursor: pointer;
        }
        button {
          background: #238636;
          border-color: #238636;
          font-weight: 600;
        }
        button:hover { background: #2ea043; }
        .logs-container {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 15px;
          height: 600px;
          overflow-y: auto;
          font-size: 12px;
          line-height: 1.5;
        }
        .log-line {
          padding: 2px 0;
          border-left: 2px solid transparent;
        }
        .log-line.error {
          color: #ff7b72;
          border-left-color: #ff7b72;
        }
        .log-line.warn {
          color: #d29922;
          border-left-color: #d29922;
        }
        .log-line.debug {
          color: #79c0ff;
          border-left-color: #79c0ff;
        }
        .log-line.success {
          color: #3fb950;
          border-left-color: #3fb950;
        }
        .log-line.info {
          color: #c9d1d9;
        }
        .timestamp {
          color: #8b949e;
          margin-right: 10px;
        }
        .refresh-info {
          margin-top: 10px;
          padding: 10px;
          background: #161b22;
          border-radius: 4px;
          font-size: 11px;
          color: #8b949e;
        }
        .status { display: flex; gap: 5px; align-items: center; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>📊 API Service Logs</h1>
          <div class="controls">
            <select id="serviceSelect">
              <option>Loading services...</option>
            </select>
            <select id="instanceSelect">
              <option value="0">Instance 0</option>
              <option value="1">Instance 1</option>
              <option value="2">Instance 2</option>
            </select>
            <input type="number" id="linesInput" value="200" min="10" max="1000" style="width: 80px;">
            <button onclick="loadLogs()">Refresh</button>
            <button onclick="autoRefresh()" id="autoBtn">Auto (5s)</button>
            <span class="status"><span class="status-dot" id="statusDot"></span><span id="status">Ready</span></span>
          </div>
        </header>
        
        <div class="logs-container" id="logs"></div>
        <div class="refresh-info">
          Last refresh: <span id="lastRefresh">Never</span> | 
          Total logs shown: <span id="logCount">0</span>
        </div>
      </div>

      <script>
        let autoRefreshInterval = null;
        let lastService = 'api-service';

        // Load available services
        async function loadServices() {
          try {
            const res = await fetch('/api/services');
            const data = await res.json();
            const select = document.getElementById('serviceSelect');
            select.innerHTML = data.services
              .map(s => \`<option value="\${s}">\${s}</option>\`)
              .join('');
            select.value = lastService;
          } catch (err) {
            document.getElementById('status').textContent = 'Error loading services';
          }
        }

        // Load and display logs
        async function loadLogs() {
          const service = document.getElementById('serviceSelect').value;
          const instance = document.getElementById('instanceSelect').value;
          const lines = document.getElementById('linesInput').value;
          
          lastService = service;
          document.getElementById('status').textContent = 'Loading...';
          document.getElementById('statusDot').style.background = '#d29922';
          
          try {
            const res = await fetch(\`/api/logs/\${service}?lines=\${lines}&instance=\${instance}\`);
            if (!res.ok) throw new Error('Failed to load logs');
            
            const data = await res.json();
            const logsDiv = document.getElementById('logs');
            
            logsDiv.innerHTML = data.logs.map(log => {
              const level = getLogLevel(log.text);
              const timestamp = log.timestamp ? \`<span class="timestamp">[\${log.timestamp}]</span>\` : '';
              return \`<div class="log-line \${level}">\${timestamp}\${log.text}</div>\`;
            }).join('');
            
            document.getElementById('logCount').textContent = data.logs.length;
            document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
            document.getElementById('status').textContent = 'Connected';
            document.getElementById('statusDot').style.background = '#3fb950';
            
            // Auto scroll to bottom
            logsDiv.scrollTop = logsDiv.scrollHeight;
          } catch (err) {
            document.getElementById('logs').innerHTML = \`<div class="log-line error">Error: \${err.message}</div>\`;
            document.getElementById('status').textContent = 'Error';
            document.getElementById('statusDot').style.background = '#ff7b72';
          }
        }

        function getLogLevel(text) {
          if (text.includes('ERROR') || text.includes('✗')) return 'error';
          if (text.includes('WARN')) return 'warn';
          if (text.includes('DEBUG')) return 'debug';
          if (text.includes('✓') || text.includes('✅')) return 'success';
          return 'info';
        }

        function autoRefresh() {
          const btn = document.getElementById('autoBtn');
          if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            btn.textContent = 'Auto (5s)';
            btn.style.background = '#238636';
          } else {
            autoRefreshInterval = setInterval(loadLogs, 5000);
            btn.textContent = 'Stop Auto';
            btn.style.background = '#da3633';
            loadLogs();
          }
        }

        // Load services on start
        loadServices();
        loadLogs();
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`📊 Log viewer running on http://localhost:${PORT}`);
  console.log(`   Logs directory: ${logDir}`);
});
