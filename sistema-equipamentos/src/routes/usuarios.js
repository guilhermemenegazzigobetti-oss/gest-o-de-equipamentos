const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const H = require('../lib/helpers');
const { requireRole } = require('../middleware/auth');
const router = express.Router();
router.param('id', (req, res, next, v) => (/^\d+$/.test(v) ? next() : next('route')));
router.use(requireRole('administrador'));

router.get('/', async (req, res, next) => {
  try {
    const w = []; const p = [];
    const busca = String(req.query.q || '').trim();
    if (busca) { w.push('(nome LIKE ? OR email LIKE ?)'); p.push(`%${busca}%`, `%${busca}%`); }
    if (H.PERFIS[req.query.perfil]) { w.push('perfil = ?'); p.push(req.query.perfil); }
    if (['1', '0'].includes(req.query.situacao)) { w.push('ativo = ?'); p.push(Number(req.query.situacao)); }
    const [itens] = await db.query(`SELECT id_usuario, nome, email, perfil, ativo FROM usuarios ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ORDER BY nome`, p);
    const [[r]] = await db.query('SELECT COUNT(*) n, SUM(ativo = 1) ativos, SUM(ativo = 0) inativos FROM usuarios');
    res.render('usuarios', { titulo: 'Usuários', active: 'usuarios', itens, q: req.query, resumo: { n: r.n, ativos: Number(r.ativos || 0), inativos: Number(r.inativos || 0) } });
  } catch (e) { next(e); }
});

async function validar(b, id) {
  const d = { nome: String(b.nome || '').trim(), email: String(b.email || '').trim().toLowerCase(), senha: String(b.senha || ''), perfil: b.perfil, ativo: b.ativo ? 1 : 0 };
  let erro = null;
  if (!d.nome) erro = 'Informe o nome do usuário.';
  else if (d.nome.length > 120) erro = 'O nome pode ter até 120 caracteres.';
  else if (!H.isEmail(d.email) || d.email.length > 150) erro = 'Informe um e-mail válido.';
  else if (!H.PERFIS[d.perfil]) erro = 'Selecione o perfil de acesso.';
  else if ((!id || d.senha) && d.senha.length < 8) erro = 'A senha deve ter pelo menos 8 caracteres.';
  else if (d.senha.length > 72) erro = 'A senha pode ter até 72 caracteres.';
  else {
    const [dup] = await db.query('SELECT 1 FROM usuarios WHERE email = ? AND id_usuario <> ?', [d.email, id || 0]);
    if (dup.length) erro = 'Já existe um usuário com esse e-mail.';
  }
  return { erro, d };
}

router.post('/', async (req, res, next) => {
  try {
    const { erro, d } = await validar(req.body, null);
    if (erro) { req.session.flash = { tipo: 'erro', msg: erro }; return res.redirect('/usuarios'); }
    const hash = await bcrypt.hash(d.senha, 12);
    await db.query('INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?,?,?,?,?)', [d.nome, d.email, hash, d.perfil, d.ativo]);
    req.session.flash = { tipo: 'ok', msg: 'Usuário salvo com sucesso' };
    return res.redirect('/usuarios');
  } catch (e) { return next(e); }
});

router.post('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { erro, d } = await validar(req.body, id);
    if (erro) { req.session.flash = { tipo: 'erro', msg: erro }; return res.redirect('/usuarios'); }
    if (id === req.session.user.id && (!d.ativo || d.perfil !== 'administrador')) {
      req.session.flash = { tipo: 'erro', msg: 'Você não pode desativar nem rebaixar a sua própria conta.' };
      return res.redirect('/usuarios');
    }
    if (d.senha) {
      await db.query('UPDATE usuarios SET nome=?, email=?, perfil=?, ativo=?, senha_hash=? WHERE id_usuario=?', [d.nome, d.email, d.perfil, d.ativo, await bcrypt.hash(d.senha, 12), id]);
    } else {
      await db.query('UPDATE usuarios SET nome=?, email=?, perfil=?, ativo=? WHERE id_usuario=?', [d.nome, d.email, d.perfil, d.ativo, id]);
    }
    req.session.flash = { tipo: 'ok', msg: 'Usuário salvo com sucesso' };
    return res.redirect('/usuarios');
  } catch (e) { return next(e); }
});

router.post('/:id/alternar', async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.session.user.id) {
      req.session.flash = { tipo: 'erro', msg: 'Você não pode desativar a sua própria conta.' };
      return res.redirect('/usuarios');
    }
    await db.query('UPDATE usuarios SET ativo = 1 - ativo WHERE id_usuario = ?', [req.params.id]);
    req.session.flash = { tipo: 'ok', msg: 'Situação do usuário atualizada' };
    return res.redirect('/usuarios');
  } catch (e) { return next(e); }
});

module.exports = router;
