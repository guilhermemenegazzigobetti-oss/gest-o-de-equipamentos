require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool de conexões. dateStrings evita problemas de fuso horário ao exibir datas.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'equipamentos_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true,
});

module.exports = pool;
