const express = require('express');
const db = require('../db');
const H = require('../lib/helpers');
const { requireRole, podeEditar } = require('../middleware/auth');
const router = express.Router();
router.param('id', (req, res, next, v) => (/^\d+$/.test(v) ? next() : next('route')));
const POR_PAGINA = 10;

// Filtros compartilhados pela listagem (e reaproveitados nos relatórios)
function filtros(q) {
  const w = []; const p = [];
  const busca = String(q.q || '').trim();
  if (busca) {
    w.push('(e.nome LIKE ? OR e.numero_patrimonio LIKE ? OR e.numero_serie LIKE ?)');
    const like = `%${busca}%`; p.push(like, like, like);
  }
  if (/^\d+$/.test(q.setor || '')) { w.push('e.id_setor = ?'); p.push(Number(q.setor)); }
  if (/^\d+$/.test(q.categoria || '')) { w.push('e.id_categoria = ?'); p.push(Number(q.categoria)); }
  if (H.SITUACOES.includes(q.situacao)) { w.push('e.situacao = ?'); p.push(q.situacao); }
  return { where: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p, busca };
}

async function listas() {
  const [setores] = await db.query('SELECT id_setor, nome, ativo FROM setores ORDER BY nome');
  const [categorias] = await db.query('SELECT id_categoria, nome FROM categorias ORDER BY nome');
  return { setores, categorias };
}

router.get('/', async (req, res, next) => {
  try {
    const f = filtros(req.query);
    const [[{ n }]] = await db.query(`SELECT COUNT(*) n FROM equipamentos e ${f.where}`, f.params);
    const totalPag = Math.max(1, Math.ceil(n / POR_PAGINA));
    const pag = Math.min(Math.max(parseInt(req.query.pagina, 10) || 1, 1), totalPag);
    const [itens] = await db.query(
      `SELECT e.id_equipamento, e.numero_patrimonio, e.nome, e.situacao, e.ativo, c.nome categoria, s.nome setor
       FROM equipamentos e JOIN categorias c ON c.id_categoria = e.id_categoria JOIN setores s ON s.id_setor = e.id_setor
       ${f.where} ORDER BY e.numero_patrimonio, e.id_equipamento LIMIT ? OFFSET ?`,
      [...f.params, POR_PAGINA, (pag - 1) * POR_PAGINA],
    );
    const qs = new URLSearchParams(Object.entries({ q: req.query.q, setor: req.query.setor, categoria: req.query.categoria, situacao: req.query.situacao }).filter(([, v]) => v));
    res.render('equipamentos', {
      titulo: 'Equipamentos', active: 'equipamentos', itens, total: n, pag, totalPag,
      paginas: H.paginas(pag, totalPag), qs: qs.toString(), inicio: n ? (pag - 1) * POR_PAGINA + 1 : 0,
      fim: Math.min(pag * POR_PAGINA, n), q: req.query, busca: f.busca, ...(await listas()), pode: podeEditar.includes(req.session.user.perfil),
    });
  } catch (e) { next(e); }
});

router.get('/novo', requireRole(...podeEditar), async (req, res, next) => {
  try {
    res.render('equipamento-form', { titulo: 'Novo equipamento', active: 'equipamentos', modo: 'novo', e: { situacao: 'Disponível' }, erros: {}, ...(await listas()) });
  } catch (err) { next(err); }
});

// Validação (RN03 e RN08): campos obrigatórios, setor ativo, patrimônio único
async function validar(b, idAtual) {
  const erros = {};
  const d = {
    numero_patrimonio: H.trimOrNull(b.numero_patrimonio), nome: String(b.nome || '').trim(),
    id_categoria: parseInt(b.id_categoria, 10) || null, marca: H.trimOrNull(b.marca), modelo: H.trimOrNull(b.modelo),
    numero_serie: H.trimOrNull(b.numero_serie), id_setor: parseInt(b.id_setor, 10) || null,
    data_aquisicao: H.trimOrNull(b.data_aquisicao), situacao: b.situacao, observacoes: H.trimOrNull(b.observacoes),
  };
  if (!d.nome) erros.nome = 'Campo obrigatório';
  else if (d.nome.length > 120) erros.nome = 'Use até 120 caracteres';
  if (!d.id_categoria) erros.id_categoria = 'Campo obrigatório';
  else {
    const [c] = await db.query('SELECT 1 FROM categorias WHERE id_categoria = ?', [d.id_categoria]);
    if (!c.length) erros.id_categoria = 'Categoria inválida';
  }
  if (!d.id_setor) erros.id_setor = 'Campo obrigatório';
  else {
    const [s] = await db.query('SELECT ativo FROM setores WHERE id_setor = ?', [d.id_setor]);
    if (!s.length) erros.id_setor = 'Setor inválido';
    else if (!s[0].ativo) {
      // permite manter o setor atual na edição, mas não vincular a um setor inativo
      const [atual] = idAtual ? await db.query('SELECT id_setor FROM equipamentos WHERE id_equipamento = ?', [idAtual]) : [[]];
      if (!atual.length || atual[0].id_setor !== d.id_setor) erros.id_setor = 'O setor selecionado está inativo';
    }
  }
  if (idAtual === null && !H.SITUACOES.includes(d.situacao)) erros.situacao = 'Campo obrigatório';
  if (d.data_aquisicao && (!H.isDate(d.data_aquisicao) || d.data_aquisicao > new Date().toISOString().slice(0, 10))) erros.data_aquisicao = 'Informe uma data válida (não futura)';
  if (d.numero_patrimonio) {
    if (d.numero_patrimonio.length > 30) erros.numero_patrimonio = 'Use até 30 caracteres';
    else {
      const [dup] = await db.query('SELECT id_equipamento FROM equipamentos WHERE numero_patrimonio = ? AND id_equipamento <> ?', [d.numero_patrimonio, idAtual || 0]);
      if (dup.length) erros.numero_patrimonio = 'Este número de patrimônio já está cadastrado';
    }
  }
  [['marca', 60], ['modelo', 60], ['numero_serie', 60]].forEach(([k, max]) => { if (d[k] && d[k].length > max) erros[k] = `Use até ${max} caracteres`; });
  if (d.observacoes && d.observacoes.length > 1000) erros.observacoes = 'Use até 1000 caracteres';
  return { erros, d };
}

router.post('/', requireRole(...podeEditar), async (req, res, next) => {
  try {
    const { erros, d } = await validar(req.body, null);
    if (Object.keys(erros).length) {
      return res.status(400).render('equipamento-form', { titulo: 'Novo equipamento', active: 'equipamentos', modo: 'novo', e: { ...req.body, ...d }, erros, ...(await listas()) });
    }
    const con = await db.getConnection();
    try {
      await con.beginTransaction();
      const [r] = await con.query(
        `INSERT INTO equipamentos (numero_patrimonio, nome, id_categoria, marca, modelo, numero_serie, id_setor, data_aquisicao, situacao, observacoes, ativo, id_usuario_cadastro)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.numero_patrimonio, d.nome, d.id_categoria, d.marca, d.modelo, d.numero_serie, d.id_setor, d.data_aquisicao, d.situacao, d.observacoes, d.situacao === 'Inativo' ? 0 : 1, req.session.user.id],
      );
      await con.query(
        'INSERT INTO historico_equipamentos (id_equipamento, id_usuario, situacao_anterior, situacao_nova, justificativa) VALUES (?,?,?,?,?)',
        [r.insertId, req.session.user.id, null, d.situacao, 'Cadastro inicial do equipamento.'],
      );
      await con.commit();
      req.session.flash = { tipo: 'ok', msg: 'Equipamento salvo com sucesso' };
      return res.redirect(`/equipamentos/${r.insertId}`);
    } catch (err) { await con.rollback(); throw err; } finally { con.release(); }
  } catch (e) { return next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, c.nome categoria, s.nome setor, u.nome cadastrado_por FROM equipamentos e
       JOIN categorias c ON c.id_categoria = e.id_categoria JOIN setores s ON s.id_setor = e.id_setor
       LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario_cadastro WHERE e.id_equipamento = ?`, [req.params.id],
    );
    if (!rows.length) return res.status(404).render('erro', { titulo: 'Equipamento não encontrado', mensagem: 'Verifique o endereço ou volte para a listagem.', active: 'equipamentos' });
    const [hist] = await db.query(
      `SELECT h.*, u.nome usuario FROM historico_equipamentos h JOIN usuarios u ON u.id_usuario = h.id_usuario
       WHERE h.id_equipamento = ? ORDER BY h.data_alteracao DESC, h.id_historico DESC`, [req.params.id],
    );
    return res.render('equipamento-detalhe', { titulo: 'Detalhes do equipamento', active: 'equipamentos', e: rows[0], hist, pode: podeEditar.includes(req.session.user.perfil), erro: req.query.erro || null });
  } catch (e) { return next(e); }
});

router.get('/:id/editar', requireRole(...podeEditar), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM equipamentos WHERE id_equipamento = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/equipamentos');
    return res.render('equipamento-form', { titulo: 'Editar equipamento', active: 'equipamentos', modo: 'editar', e: rows[0], erros: {}, ...(await listas()) });
  } catch (e) { return next(e); }
});

router.post('/:id', requireRole(...podeEditar), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [atual] = await db.query('SELECT * FROM equipamentos WHERE id_equipamento = ?', [id]);
    if (!atual.length) return res.redirect('/equipamentos');
    const { erros, d } = await validar({ ...req.body, situacao: atual[0].situacao }, id);
    if (Object.keys(erros).length) {
      return res.status(400).render('equipamento-form', { titulo: 'Editar equipamento', active: 'equipamentos', modo: 'editar', e: { ...atual[0], ...req.body, id_equipamento: id }, erros, ...(await listas()) });
    }
    // a situação NÃO muda aqui: alterações de situação passam por "Alterar situação" (RN06)
    await db.query(
      `UPDATE equipamentos SET numero_patrimonio=?, nome=?, id_categoria=?, marca=?, modelo=?, numero_serie=?, id_setor=?, data_aquisicao=?, observacoes=? WHERE id_equipamento=?`,
      [d.numero_patrimonio, d.nome, d.id_categoria, d.marca, d.modelo, d.numero_serie, d.id_setor, d.data_aquisicao, d.observacoes, id],
    );
    req.session.flash = { tipo: 'ok', msg: 'Equipamento salvo com sucesso' };
    return res.redirect(`/equipamentos/${id}`);
  } catch (e) { return next(e); }
});

// Altera a situação e grava o histórico na mesma transação (RN06)
async function mudarSituacao(req, res, next, nova, voltarPara) {
  try {
    const id = Number(req.params.id);
    const just = String(req.body.justificativa || '').trim();
    const volta = voltarPara || `/equipamentos/${id}`;
    if (!H.SITUACOES.includes(nova)) { req.session.flash = { tipo: 'erro', msg: 'Situação inválida.' }; return res.redirect(volta); }
    if (just.length < 5) { req.session.flash = { tipo: 'erro', msg: 'Informe a justificativa (mínimo de 5 caracteres).' }; return res.redirect(volta); }
    if (just.length > 500) { req.session.flash = { tipo: 'erro', msg: 'A justificativa pode ter até 500 caracteres.' }; return res.redirect(volta); }
    const con = await db.getConnection();
    try {
      await con.beginTransaction();
      const [r] = await con.query('SELECT situacao FROM equipamentos WHERE id_equipamento = ? FOR UPDATE', [id]);
      if (!r.length) { await con.rollback(); return res.redirect('/equipamentos'); }
      if (r[0].situacao === nova) { await con.rollback(); req.session.flash = { tipo: 'erro', msg: 'O equipamento já está nessa situação.' }; return res.redirect(volta); }
      await con.query('UPDATE equipamentos SET situacao = ?, ativo = ? WHERE id_equipamento = ?', [nova, nova === 'Inativo' ? 0 : 1, id]);
      await con.query(
        'INSERT INTO historico_equipamentos (id_equipamento, id_usuario, situacao_anterior, situacao_nova, justificativa) VALUES (?,?,?,?,?)',
        [id, req.session.user.id, r[0].situacao, nova, just],
      );
      await con.commit();
    } catch (err) { await con.rollback(); throw err; } finally { con.release(); }
    req.session.flash = { tipo: 'ok', msg: 'Situação atualizada e registrada no histórico' };
    return res.redirect(volta);
  } catch (e) { return next(e); }
}

router.post('/:id/situacao', requireRole(...podeEditar), (req, res, next) => mudarSituacao(req, res, next, req.body.nova_situacao));
router.post('/:id/desativar', requireRole(...podeEditar), (req, res, next) => mudarSituacao(req, res, next, 'Inativo', req.body.voltar === 'lista' ? '/equipamentos' : null));
router.post('/:id/reativar', requireRole(...podeEditar), (req, res, next) => mudarSituacao(req, res, next, 'Disponível', req.body.voltar === 'lista' ? '/equipamentos' : null));

module.exports = router;
module.exports.filtros = filtros;
