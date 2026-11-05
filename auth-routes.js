const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();
const JANELA_MS = 15 * 60 * 1000;
const LIMITE = 5;
const DUMMY_HASH = '$2b$12$lrv7HZX9EpZFkBqxc6OB9uNPEMGJPpHKKehHe2/oopYRaxzKODNkq';

function fingerprint(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(String(value || '')).digest('hex');
}

async function consultarBloqueio(ip, login) {
  const zero = '0'.repeat(64);
  const chaves = [
    { ipHash: fingerprint(ip), loginHash: zero }, // limite global por IP
    { ipHash: zero, loginHash: fingerprint(login.toLowerCase()) }, // limite global por conta
  ];
  for (const chave of chaves) {
    const [rows] = await db.query(
      `SELECT tentativas, UNIX_TIMESTAMP(inicio_janela) * 1000 AS inicio_ms,
              IF(bloqueado_ate IS NULL, NULL, UNIX_TIMESTAMP(bloqueado_ate) * 1000) AS bloqueado_ms
       FROM tentativas_login WHERE ip_hash = ? AND login_hash = ? LIMIT 1`, [chave.ipHash, chave.loginHash],
    );
    const row = rows[0];
    if (!row) continue;
    const agora = Date.now();
    const inicio = Number(row.inicio_ms);
    const bloqueadoAte = Number(row.bloqueado_ms || 0);
    if (bloqueadoAte > agora) return { bloqueado: true, chaves };
    if (agora - inicio >= JANELA_MS) {
      await db.query('DELETE FROM tentativas_login WHERE ip_hash = ? AND login_hash = ?', [chave.ipHash, chave.loginHash]);
    } else if (Number(row.tentativas) >= LIMITE) return { bloqueado: true, chaves };
  }
  return { bloqueado: false, chaves };
}

async function registrarFalha(controle) {
  // Incremento atômico no MySQL evita perda de contagem em tentativas concorrentes.
  for (const chave of controle.chaves) {
    await db.query(
      `INSERT INTO tentativas_login (ip_hash, login_hash, tentativas, inicio_janela, bloqueado_ate)
       VALUES (?, ?, 1, NOW(), NULL)
       ON DUPLICATE KEY UPDATE
         tentativas = IF(inicio_janela <= DATE_SUB(NOW(), INTERVAL 15 MINUTE), 1, tentativas + 1),
         bloqueado_ate = IF(tentativas >= ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), bloqueado_ate),
         inicio_janela = IF(inicio_janela <= DATE_SUB(NOW(), INTERVAL 15 MINUTE), NOW(), inicio_janela)`,
      [chave.ipHash, chave.loginHash, LIMITE],
    );
  }
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  return res.render('login', { erro: null, valor: '' });
});

router.post('/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim().slice(0, 150);
    const senha = String(req.body.senha || '');
    if (!login || !senha || Buffer.byteLength(senha, 'utf8') > 72) {
      return res.status(400).render('login', { erro: 'Informe o usuário ou e-mail e a senha.', valor: login });
    }
    const chave = await consultarBloqueio(req.ip, login);
    if (chave.bloqueado) {
      return res.status(429).render('login', { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', valor: login });
    }
    const [rows] = await db.query(
      'SELECT id_usuario, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ? OR SUBSTRING_INDEX(email, "@", 1) = ? LIMIT 1',
      [login, login],
    );
    const u = rows[0];
    const hash = u ? u.senha_hash : DUMMY_HASH;
    const ok = await bcrypt.compare(senha, hash).catch(() => false);
    if (!u || !ok || !u.ativo) {
      await registrarFalha(chave);
      return res.status(401).render('login', { erro: 'Usuário ou senha inválidos', valor: login });
    }
    // Zera as janelas após autenticação válida.
    for (const item of chave.chaves) {
      await db.query('DELETE FROM tentativas_login WHERE ip_hash = ? AND login_hash = ?', [item.ipHash, item.loginHash]);
    }
    // Nunca aceitar destino externo ou URL protocol-relative.
    const destinoBruto = req.session.returnTo;
    const destino = typeof destinoBruto === 'string'
      && destinoBruto.startsWith('/') && !destinoBruto.startsWith('//')
      && !/[\\\r\n]/.test(destinoBruto) ? destinoBruto : '/';
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: u.id_usuario, nome: u.nome, email: u.email, perfil: u.perfil };
      return req.session.save((saveErr) => saveErr ? next(saveErr) : res.redirect(destino));
    });
    return undefined;
  } catch (error) { return next(error); }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.redirect('/login');
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('cemg.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.redirect('/login');
  });
});

module.exports = router;
