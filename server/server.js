import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import { initializeSocketIO } from './sockets/index.js';
import { initializeDatabase } from './config/schema.js';
import authRoutes from './routes/authRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Initialize database schema
initializeDatabase().catch(console.error);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Room creation endpoint
app.get('/api/videoroom/create', (req, res) => {
  const roomId = uuidv4();
  res.json({ roomId });
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Smiya API Server</h1>
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
  console.log(`🚀 Server: \x1b[36m${localUrl}\x1b[0m`);
});

// Initialize Socket.IO with unified handlers
initializeSocketIO(server, app);