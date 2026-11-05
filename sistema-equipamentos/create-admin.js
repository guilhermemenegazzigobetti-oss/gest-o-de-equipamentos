require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const nome = String(process.env.ADMIN_NAME || '').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = String(process.env.ADMIN_PASSWORD || '');
  if (!nome || nome.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 150 || senha.length < 12 || Buffer.byteLength(senha, 'utf8') > 72) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD. A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes em UTF-8.');
  }
  const [existente] = await db.query('SELECT id_usuario FROM usuarios WHERE email = ? LIMIT 1', [email]);
  if (existente.length) throw new Error('Já existe uma conta com esse e-mail. Use outro endereço ou redefina a conta existente de forma controlada.');
  const hash = await bcrypt.hash(senha, 12);
  await db.query('INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)', [nome, email, hash, 'administrador']);
  console.log(`Conta administrativa criada para ${email}. Remova ADMIN_PASSWORD do ambiente após a execução.`);
}

main().catch((error) => { console.error('Não foi possível criar o administrador:', error.message); process.exitCode = 1; })
  .finally(() => db.end());
