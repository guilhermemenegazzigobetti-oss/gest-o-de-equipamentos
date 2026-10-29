const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const H = require('../lib/helpers');
const { filtros } = require('./equipamentos');
const router = express.Router();
const POR_PAGINA = 10;

// RN09: todos os relatórios respeitam os filtros escolhidos (setor, categoria, situação)
function filtrosRel(q) { return filtros({ setor: q.setor, categoria: q.categoria, situacao: q.situacao }); }

async function resumoEquip(f) {
  const [porSit] = await db.query(`SELECT e.situacao, COUNT(*) n FROM equipamentos e ${f.where} GROUP BY e.situacao`, f.params);
  const [[s]] = await db.query(`SELECT COUNT(DISTINCT e.id_setor) n FROM equipamentos e ${f.where}`, f.params);
  const mapa = Object.fromEntries(porSit.map((r) => [r.situacao, r.n]));
  const total = porSit.reduce((a, r) => a + r.n, 0);
  return { total, setores: s.n, mapa, atencao: (mapa['Em manutenção'] || 0) + (mapa.Defeituoso || 0) };
}

const SQL_ITENS = `SELECT e.numero_patrimonio, e.nome, c.nome categoria, s.nome setor, e.situacao
  FROM equipamentos e JOIN categorias c ON c.id_categoria = e.id_categoria JOIN setores s ON s.id_setor = e.id_setor`;

async function dadosSetores(q) {
  const f = filtrosRel(q);
  const [setores] = await db.query(`SELECT id_setor, nome, localizacao FROM setores ${/^\d+$/.test(q.setor || '') ? 'WHERE id_setor = ?' : ''} ORDER BY nome`, /^\d+$/.test(q.setor || '') ? [Number(q.setor)] : []);
  const [cats] = await db.query('SELECT nome FROM categorias ORDER BY nome');
  const [linhas] = await db.query(
    `SELECT e.id_setor, c.nome categoria, e.situacao, COUNT(*) n FROM equipamentos e JOIN categorias c ON c.id_categoria = e.id_categoria
     ${f.where} GROUP BY e.id_setor, c.nome, e.situacao`, f.params,
  );
  const rows = setores.map((s) => {
    const mine = linhas.filter((l) => l.id_setor === s.id_setor);
    const porCat = {}; const porSit = {};
    cats.forEach((c) => { porCat[c.nome] = 0; }); H.SITUACOES.forEach((x) => { porSit[x] = 0; });
    mine.forEach((l) => { porCat[l.categoria] += l.n; porSit[l.situacao] += l.n; });
    const total = mine.reduce((a, l) => a + l.n, 0);
    const manut = porSit['Em manutenção']; const def = porSit.Defeituoso;
    return { ...s, total, porCat, porSit, manut, def, atencao: manut + def };
  });
  const tot = { total: 0, manut: 0, def: 0, porCat: {}, porSit: {} };
  cats.forEach((c) => { tot.porCat[c.nome] = 0; }); H.SITUACOES.forEach((x) => { tot.porSit[x] = 0; });
  rows.forEach((r) => {
    tot.total += r.total; tot.manut += r.manut; tot.def += r.def;
    cats.forEach((c) => { tot.porCat[c.nome] += r.porCat[c.nome]; }); H.SITUACOES.forEach((x) => { tot.porSit[x] += r.porSit[x]; });
  });
  const destaque = rows.filter((r) => r.atencao > 0).sort((a, b) => b.atencao - a.atencao || a.nome.localeCompare(b.nome)).slice(0, 2)
    .map((r) => ({ ...r, pct: r.total ? ((r.atencao / r.total) * 100).toFixed(1).replace('.', ',').replace(',0', '') : '0' }));
  const atencaoTotal = tot.manut + tot.def;
  const somaDestaque = destaque.reduce((a, r) => a + r.atencao, 0);
  return { rows, cats: cats.map((c) => c.nome), tot, destaque, atencaoTotal, somaDestaque, pctDestaque: atencaoTotal ? ((somaDestaque / atencaoTotal) * 100).toFixed(1).replace('.', ',') : '0' };
}

router.get('/', async (req, res, next) => {
  try {
    const aba = req.query.aba === 'setores' ? 'setores' : 'equipamentos';
    const f = filtrosRel(req.query);
    const resumo = await resumoEquip(f);
    const [setores] = await db.query('SELECT id_setor, nome FROM setores ORDER BY nome');
    const [categorias] = await db.query('SELECT id_categoria, nome FROM categorias ORDER BY nome');
    const base = { titulo: 'Relatórios', active: 'relatorios', aba, resumo, q: req.query, setores, categorias, hoje: H.fmtDate(new Date().toISOString().slice(0, 10)),
      qs: new URLSearchParams(Object.entries({ setor: req.query.setor, categoria: req.query.categoria, situacao: req.query.situacao }).filter(([, v]) => v)).toString() };
    if (aba === 'setores') return res.render('relatorios', { ...base, S: await dadosSetores(req.query) });
    const totalPag = Math.max(1, Math.ceil(resumo.total / POR_PAGINA));
    const pag = Math.min(Math.max(parseInt(req.query.pagina, 10) || 1, 1), totalPag);
    const [itens] = await db.query(`${SQL_ITENS} ${f.where} ORDER BY e.numero_patrimonio LIMIT ? OFFSET ?`, [...f.params, POR_PAGINA, (pag - 1) * POR_PAGINA]);
    return res.render('relatorios', { ...base, itens, pag, totalPag, paginas: H.paginas(pag, totalPag), inicio: resumo.total ? (pag - 1) * POR_PAGINA + 1 : 0, fim: Math.min(pag * POR_PAGINA, resumo.total) });
  } catch (e) { return next(e); }
});

// ---------- Exportações (usam TODOS os resultados filtrados, não só a página) ----------
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
const csv = (linhas) => `\uFEFF${linhas.map((l) => l.map(csvCell).join(';')).join('\r\n')}\r\n`;

async function tabelaExport(q) {
  if (q.aba === 'setores') {
    const S = await dadosSetores(q);
    return {
      titulo: 'Relatório de setores', nome: 'relatorio-setores',
      cab: ['Setor', 'Localização', ...S.cats, ...H.SITUACOES, 'Total'],
      linhas: [...S.rows.map((r) => [r.nome, r.localizacao, ...S.cats.map((c) => r.porCat[c]), ...H.SITUACOES.map((x) => r.porSit[x]), r.total]),
        ['Total geral', 'Todos os blocos', ...S.cats.map((c) => S.tot.porCat[c]), ...H.SITUACOES.map((x) => S.tot.porSit[x]), S.tot.total]],
    };
  }
  const f = filtrosRel(q);
  const [itens] = await db.query(`${SQL_ITENS} ${f.where} ORDER BY e.numero_patrimonio`, f.params);
  return { titulo: 'Relatório de equipamentos', nome: 'relatorio-equipamentos', cab: ['Patrimônio', 'Nome', 'Categoria', 'Setor', 'Situação'], linhas: itens.map((i) => [i.numero_patrimonio || '', i.nome, i.categoria, i.setor, i.situacao]) };
}

router.get('/exportar.csv', async (req, res, next) => {
  try {
    const t = await tabelaExport(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${t.nome}.csv"`);
    res.send(csv([t.cab, ...t.linhas]));
  } catch (e) { next(e); }
});

router.get('/exportar.pdf', async (req, res, next) => {
  try {
    const t = await tabelaExport(req.query);
    const f = filtrosRel(req.query);
    const r = await resumoEquip(f);
    const land = t.cab.length > 6;
    const doc = new PDFDocument({ size: 'A4', layout: land ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${t.nome}.pdf"`);
    doc.pipe(res);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1E4FA3').text('Colégio Estadual Mendes Gonçalves');
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1F2937').text(t.titulo);
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${req.session.user.nome}`);
    doc.moveDown(0.6).fillColor('#1F2937').fontSize(10)
      .text(`Equipamentos: ${r.total}   Setores: ${r.setores}   Com atenção: ${r.atencao}`)
      .text(H.SITUACOES.map((s) => `${s}: ${r.mapa[s] || 0}`).join('   '));
    doc.moveDown(0.8);
    const largura = doc.page.width - 72; const cw = largura / t.cab.length;
    const linha = (cels, negrito) => {
      const y0 = doc.y;
      doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(land ? 7.5 : 9).fillColor('#1F2937');
      let h = 0;
      cels.forEach((c, i) => { h = Math.max(h, doc.heightOfString(String(c), { width: cw - 6 })); });
      if (y0 + h + 8 > doc.page.height - 50) { doc.addPage(); }
      const y = doc.y;
      if (negrito) doc.rect(36, y - 2, largura, h + 6).fill('#EEF2F8').fillColor('#1F2937');
      cels.forEach((c, i) => doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').text(String(c), 36 + i * cw + 2, y, { width: cw - 6 }));
      doc.y = y + h + 6;
      doc.moveTo(36, doc.y - 2).lineTo(36 + largura, doc.y - 2).strokeColor('#E6EAF2').lineWidth(0.5).stroke();
    };
    linha(t.cab, true);
    if (!t.linhas.length) doc.moveDown().text('Nenhum registro para os filtros selecionados.', 36);
    t.linhas.forEach((l) => linha(l, false));
    const n = doc.bufferedPageRange().count;
    for (let i = 0; i < n; i += 1) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9AA3B2').text(`Página ${i + 1} de ${n}`, 36, doc.page.height - 30, { width: largura, align: 'right', lineBreak: false });
    }
    doc.end();
  } catch (e) { next(e); }
});

module.exports = router;
