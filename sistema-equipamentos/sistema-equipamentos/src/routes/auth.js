const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

// Limite simples de tentativas por IP (5 falhas / 15 min)
const tentativas = new Map();
const JANELA = 15 * 60 * 1000;
function bloqueado(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > JANELA) return false;
  return t.n >= 5;
}
function falhou(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > JANELA) tentativas.set(ip, { n: 1, inicio: Date.now() });
  else t.n += 1;
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  return res.render('login', { erro: null, valor: '' });
});

router.post('/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim();
    const senha = String(req.body.senha || '');
    if (bloqueado(req.ip)) {
      return res.status(429).render('login', { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', valor: login });
    }
    if (!login || !senha) {
      return res.status(400).render('login', { erro: 'Informe o usuário ou e-mail e a senha.', valor: login });
    }
    // Consulta parametrizada: aceita o e-mail completo ou só a parte antes do @
    const [rows] = await db.query(
      'SELECT id_usuario, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ? OR SUBSTRING_INDEX(email, "@", 1) = ? LIMIT 1',
      [login, login],
    );
    const u = rows[0];
    // compara sempre (hash fictício se o usuário não existe) para não revelar quais contas existem
    const hash = u ? u.senha_hash : '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(senha, hash).catch(() => false);
    if (!u || !ok || !u.ativo) {
      falhou(req.ip);
      return res.status(401).render('login', { erro: 'Usuário ou senha inválidos', valor: login });
    }
    tentativas.delete(req.ip);
    const destino = req.session.returnTo || '/';
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: u.id_usuario, nome: u.nome, email: u.email, perfil: u.perfil };
      return req.session.save(() => res.redirect(destino));
    });
    return undefined;
  } catch (e) { return next(e); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('cemg.sid');
    res.redirect('/login');
  });
});

module.exports = router;
