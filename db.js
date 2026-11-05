require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

const production = process.env.NODE_ENV === 'production';
if (production && (!process.env.DB_USER || process.env.DB_USER === 'root' || !process.env.DB_PASSWORD)) {
  throw new Error('Em produção, configure DB_USER e DB_PASSWORD de um usuário MySQL exclusivo (não use root).');
}

const ssl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: true, ...(process.env.DB_SSL_CA ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') } : {}) }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'cemg_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'equipamentos_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,
  connectTimeout: 10000,
  charset: 'utf8mb4',
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(ssl ? { ssl } : {}),
});

module.exports = pool;
