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

// Database Test
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('DB Connection Error:', err);
  else console.log(`Connected to database (${NODE_ENV} environment)`);
});

// Socket.io Setup
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});
initSockets(server);