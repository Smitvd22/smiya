import express from 'express';
import cors from 'cors';
import { initSockets } from './sockets/messaging.js';
import { pool } from './config/db.js';
// No need to import dotenv here as it's already loaded in db.js

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(express.json());
app.use(cors({
  // Use more restrictive CORS in production
  origin: NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS : '*'
}));

// Add a basic route to check server status
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Add a root route for browser testing
app.get('/', (req, res) => {
  res.send(`
    <h1>Smiya Server</h1>
    <p>Status: Running</p>
    <p>Environment: ${NODE_ENV}</p>
    <p>Timestamp: ${new Date().toISOString()}</p>
    <p><a href="/api/status">API Status (JSON)</a></p>
  `);
});

// Database Test
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('DB Connection Error:', err);
  else console.log(`Connected to database (${NODE_ENV} environment)`);
});

// Socket.io Setup
const server = app.listen(PORT, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`📡 API Status: ${localUrl}/api/status`);
  // Terminal clickable link (works in most modern terminals)
  console.log(`🚀 Server: \x1b[36m${localUrl}\x1b[0m`);
});
initSockets(server);