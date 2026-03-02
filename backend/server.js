require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ocrRoutes = require('./routes/ocr');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads and output directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Store active SSE connections
const activeClients = new Map();

const productRoutes = require('./routes/products');

// Routes
app.use('/api/ocr', ocrRoutes);
app.use('/api/products', productRoutes);

// SSE Progress Stream
app.get('/api/ocr/stream-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add client id to map
  const clientId = Date.now();
  activeClients.set(clientId, res);

  const keepAlive = setInterval(() => {
    res.write(':\n\n'); // keep-alive comment
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    activeClients.delete(clientId);
  });
});

// Broadcast progress function to attach to response or use globally
const broadcastProgress = (stage, percentage, message) => {
  const data = JSON.stringify({ stage, percentage, message });
  activeClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
};

// Make broadcast available to routes
app.set('broadcastProgress', broadcastProgress);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 OCR PO Server running on http://localhost:${PORT}`);
});
