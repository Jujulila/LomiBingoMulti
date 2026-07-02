const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Port configurations
const PORT = process.env.PORT || 8080;

// Central Shared Server State
let gameState = {
  rows: 4,
  cols: 4,
  cells: Array(16).fill(null).map(() => ({ text: "Vide", checked: false, color: null }))
};

// Serve static files (so index.html and image assets can be hosted straight from here)
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  const extname = String(path.extname(filePath)).toLowerCase();
  
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found', 'utf-8');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Setup WebSockets over HTTP
const wss = new WebSocket.Server({ server });

function broadcast(messageObj) {
  const payload = JSON.stringify(messageObj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  // 1. Instantly send current board state to joining player
  ws.send(JSON.stringify({
    type: 'SYNC',
    rows: gameState.rows,
    cols: gameState.cols,
    cells: gameState.cells
  }));

  // 2. Process incoming player intents
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'CLAIM') {
        const targetCell = gameState.cells[data.index];
        // Server Verification Rule: Only process claim if cell isn't already checked!
        if (targetCell && !targetCell.checked) {
          targetCell.checked = true;
          targetCell.color = data.color || '#3b82f6';
          
          // Broadcast update to all connected players
          broadcast({
            type: 'UPDATE',
            rows: gameState.rows,
            cols: gameState.cols,
            cells: gameState.cells
          });
        }
      } 
      
      else if (data.type === 'IMPORT') {
        // Handle full board updates when a host uploads a pre-configured JSON file
        gameState.rows = data.rows || 4;
        gameState.cols = data.cols || 4;
        gameState.cells = data.cells.map(c => ({
          text: c.text || "Vide",
          checked: c.checked || false,
          color: c.color || null
        }));

        broadcast({
          type: 'UPDATE',
          rows: gameState.rows,
          cols: gameState.cols,
          cells: gameState.cells
        });
      }
    } catch (e) {
      console.error("Error handling incoming socket message:", e);
    }
  });
});

server.listen(PORT, () => {
  console.log(`LomiBingo Multiplayer active on http://localhost:${PORT}`);
});