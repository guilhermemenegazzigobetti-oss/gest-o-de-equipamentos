const express = require('express');
const db = require('../db');
const { SITUACOES, COR } = require('../lib/helpers');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [[tot]] = await db.query('SELECT COUNT(*) n FROM equipamentos');
    const [[set]] = await db.query('SELECT COUNT(*) n FROM setores WHERE ativo = 1');
    const [porSit] = await db.query('SELECT situacao, COUNT(*) n FROM equipamentos GROUP BY situacao');
    const [porSetor] = await db.query(
      `SELECT s.nome, COUNT(e.id_equipamento) n FROM setores s
       LEFT JOIN equipamentos e ON e.id_setor = s.id_setor
       WHERE s.ativo = 1 GROUP BY s.id_setor, s.nome ORDER BY n DESC, s.nome`,
    );
    const [ultimas] = await db.query(
      `SELECT h.situacao_anterior, h.situacao_nova, h.data_alteracao, u.nome usuario, e.nome equipamento, e.numero_patrimonio, e.id_equipamento
       FROM historico_equipamentos h
       JOIN equipamentos e ON e.id_equipamento = h.id_equipamento
       JOIN usuarios u ON u.id_usuario = h.id_usuario
       WHERE h.situacao_anterior IS NOT NULL
       ORDER BY h.data_alteracao DESC, h.id_historico DESC LIMIT 5`,
    );
    const mapa = Object.fromEntries(porSit.map((r) => [r.situacao, r.n]));
    const situacoes = SITUACOES.map((s) => ({ nome: s, n: mapa[s] || 0, cor: COR[s] }));
    // gradiente do gráfico de rosca
    let acc = 0;
    const partes = situacoes.filter((s) => s.n).map((s) => {
      const ini = (acc / tot.n) * 100; acc += s.n; const fim = (acc / tot.n) * 100;
      return `${s.cor} ${ini.toFixed(2)}% ${fim.toFixed(2)}%`;
    });
    const donut = partes.length ? `conic-gradient(${partes.join(', ')})` : '#E6EAF2';
    const atencao = (mapa['Em manutenção'] || 0) + (mapa['Defeituoso'] || 0);
    const atualizado = ultimas[0] ? String(ultimas[0].data_alteracao).slice(11, 16) : new Date().toTimeString().slice(0, 5);
    res.render('dashboard', {
      titulo: 'Dashboard', active: 'dashboard', total: tot.n, setores: set.n, mapa, situacoes, donut,
      porSetor, maxSetor: Math.max(1, ...porSetor.map((s) => s.n)), ultimas, atencao, atualizado,
      hoje: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
  } catch (e) { next(e); }
});

module.exports = router;
