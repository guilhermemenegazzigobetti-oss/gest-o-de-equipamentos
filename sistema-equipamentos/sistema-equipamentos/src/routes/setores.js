const express = require('express');
const db = require('../db');
const H = require('../lib/helpers');
const { requireRole } = require('../middleware/auth');
const router = express.Router();
router.param('id', (req, res, next, v) => (/^\d+$/.test(v) ? next() : next('route')));
const admin = requireRole('administrador');

router.get('/', async (req, res, next) => {
  try {
    const w = []; const p = [];
    const busca = String(req.query.q || '').trim();
    if (busca) { w.push('(s.nome LIKE ? OR s.localizacao LIKE ? OR s.responsavel LIKE ?)'); const l = `%${busca}%`; p.push(l, l, l); }
    if (['1', '0'].includes(req.query.situacao)) { w.push('s.ativo = ?'); p.push(Number(req.query.situacao)); }
    const [itens] = await db.query(
      `SELECT s.*, COUNT(e.id_equipamento) qtde FROM setores s LEFT JOIN equipamentos e ON e.id_setor = s.id_setor
       ${w.length ? `WHERE ${w.join(' AND ')}` : ''} GROUP BY s.id_setor ORDER BY s.nome`, p,
    );
    const [[res1]] = await db.query('SELECT COUNT(*) n, SUM(ativo = 1) ativos, SUM(ativo = 0) inativos FROM setores');
    const [[eq]] = await db.query('SELECT COUNT(*) n FROM equipamentos');
    const [resp] = await db.query('SELECT nome FROM usuarios WHERE ativo = 1 ORDER BY nome');
    res.render('setores', {
      titulo: 'Setores', active: 'setores', itens, resumo: { n: res1.n, ativos: Number(res1.ativos || 0), inativos: Number(res1.inativos || 0), equip: eq.n },
      q: req.query, responsaveis: resp, pode: req.session.user.perfil === 'administrador',
    });
  } catch (e) { next(e); }
});

async function validar(b, id) {
  const d = { nome: String(b.nome || '').trim(), descricao: H.trimOrNull(b.descricao), localizacao: String(b.localizacao || '').trim(), responsavel: H.trimOrNull(b.responsavel), ativo: b.ativo ? 1 : 0 };
  let erro = null;
  if (!d.nome) erro = 'Informe o nome do setor.';
  else if (d.nome.length > 120) erro = 'O nome pode ter até 120 caracteres.';
  else if (!d.localizacao) erro = 'Informe a localização física.';
  else if (d.localizacao.length > 120) erro = 'A localização pode ter até 120 caracteres.';
  else if (d.descricao && d.descricao.length > 255) erro = 'A descrição pode ter até 255 caracteres.';
  else {
    const [dup] = await db.query('SELECT 1 FROM setores WHERE nome = ? AND id_setor <> ?', [d.nome, id || 0]);
    if (dup.length) erro = 'Já existe um setor com esse nome.';
  }
  return { erro, d };
}

router.post('/', admin, async (req, res, next) => {
  try {
    const { erro, d } = await validar(req.body, null);
    if (erro) { req.session.flash = { tipo: 'erro', msg: erro }; return res.redirect('/setores'); }
    await db.query('INSERT INTO setores (nome, descricao, localizacao, responsavel, ativo) VALUES (?,?,?,?,?)', [d.nome, d.descricao, d.localizacao, d.responsavel, d.ativo]);
    req.session.flash = { tipo: 'ok', msg: 'Setor salvo com sucesso' };
    return res.redirect('/setores');
  } catch (e) { return next(e); }
});

router.post('/:id', admin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { erro, d } = await validar(req.body, id);
    if (erro) { req.session.flash = { tipo: 'erro', msg: erro }; return res.redirect('/setores'); }
    await db.query('UPDATE setores SET nome=?, descricao=?, localizacao=?, responsavel=?, ativo=? WHERE id_setor=?', [d.nome, d.descricao, d.localizacao, d.responsavel, d.ativo, id]);
    req.session.flash = { tipo: 'ok', msg: 'Setor salvo com sucesso' };
    return res.redirect('/setores');
  } catch (e) { return next(e); }
});

// RN07: setor nunca é excluído fisicamente; apenas ativado/desativado
router.post('/:id/alternar', admin, async (req, res, next) => {
  try {
    await db.query('UPDATE setores SET ativo = 1 - ativo WHERE id_setor = ?', [req.params.id]);
    req.session.flash = { tipo: 'ok', msg: 'Situação do setor atualizada' };
    res.redirect('/setores');
  } catch (e) { next(e); }
});

module.exports = router;
