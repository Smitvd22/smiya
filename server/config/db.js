import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load appropriate .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const isProduction = process.env.NODE_ENV === 'production';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // In production, use SSL. For local development, don't use SSL unless specified
  ssl: isProduction || process.env.DB_USE_SSL === 'true' 
    ? { 
        rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED !== 'false' 
      } 
    : false
});

// Log which environment is being used
console.log(`Database configured for ${isProduction ? 'production' : 'development'} environment`);