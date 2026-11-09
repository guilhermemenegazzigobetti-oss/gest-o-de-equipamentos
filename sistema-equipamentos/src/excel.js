// Geração de planilhas Excel (.xlsx) organizadas: cabeçalho institucional com logo,
// cor da escola, colunas ajustadas ao conteúdo, filtros, painel congelado e impressão A4.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const H = require('./helpers');

const COR_ESCOLA = 'FF1E4FA3'; // mesma cor primária do sistema (--primaria)
const COR_CLARA = 'FFEEF2F8';
const COR_BORDA = 'FFD5DBE6';
const LOGO = path.join(__dirname, '..', '..', 'public', 'img', 'logo-colegio.png');

const borda = { style: 'thin', color: { argb: COR_BORDA } };
const bordas = { top: borda, left: borda, bottom: borda, right: borda };
const argb = (hex) => `FF${String(hex).replace('#', '')}`;

function larguraColuna(cab, linhas, i) {
  const maior = Math.max(String(cab[i]).length, ...linhas.map((l) => String(l[i] ?? '').length));
  return Math.min(Math.max(maior + 3, 10), 48);
}

/**
 * @param {{titulo:string, nome:string, cab:string[], linhas:any[][]}} t  tabela a exportar
 * @param {{total:number, setores:number, atencao:number, mapa:Object}} resumo
 * @param {string} usuario  nome de quem gerou
 * @returns {Promise<Buffer>}
 */
async function gerarXlsx(t, resumo, usuario) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gerenciamento de Equipamentos';
  wb.created = new Date();
  const ws = wb.addWorksheet(t.titulo.slice(0, 31), {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: t.cab.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });
  const nCols = t.cab.length;
  const ultima = ws.getColumn(nCols).letter;
  t.cab.forEach((_, i) => { ws.getColumn(i + 1).width = larguraColuna(t.cab, t.linhas, i); });

  // ---- Cabeçalho institucional (linhas 1-3) ----
  const temLogo = fs.existsSync(LOGO);
  const colTexto = temLogo ? 2 : 1;
  const letraTexto = ws.getColumn(colTexto).letter;
  [1, 2, 3].forEach((r) => { ws.getRow(r).height = 24; });
  ws.mergeCells(`${letraTexto}1:${ultima}1`);
  ws.mergeCells(`${letraTexto}2:${ultima}2`);
  ws.mergeCells(`${letraTexto}3:${ultima}3`);
  const c1 = ws.getCell(`${letraTexto}1`);
  c1.value = 'Colégio Estadual Mendes Gonçalves';
  c1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COR_ESCOLA } };
  c1.alignment = { vertical: 'middle', indent: 1 };
  const c2 = ws.getCell(`${letraTexto}2`);
  c2.value = t.titulo;
  c2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1F2937' } };
  c2.alignment = { vertical: 'middle', indent: 1 };
  const c3 = ws.getCell(`${letraTexto}3`);
  c3.value = `Gerado em ${new Date().toLocaleString('pt-BR')} por ${usuario}`;
  c3.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
  c3.alignment = { vertical: 'middle', indent: 1 };
  if (temLogo) {
    const img = wb.addImage({ filename: LOGO, extension: 'png' });
    ws.addImage(img, { tl: { col: 0.15, row: 0.1 }, ext: { width: 66, height: 66 } });
    if (ws.getColumn(1).width < 11) ws.getColumn(1).width = 11;
  }
  // faixa na cor da escola
  ws.getRow(4).height = 5;
  for (let c = 1; c <= nCols; c += 1) ws.getRow(4).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_ESCOLA } };

  // ---- Resumo (linha 5-6) ----
  ws.mergeCells(`A6:${ultima}6`);
  const res = ws.getCell('A6');
  res.value = `Equipamentos: ${resumo.total}   •   Setores: ${resumo.setores}   •   Com atenção (manutenção/defeituoso): ${resumo.atencao}`;
  res.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
  res.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CLARA } };
  res.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  ws.getRow(6).height = 22;

  // ---- Tabela ----
  const linhaCab = 8;
  const cab = ws.getRow(linhaCab);
  t.cab.forEach((txt, i) => {
    const c = cab.getCell(i + 1);
    c.value = txt;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_ESCOLA } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = bordas;
  });
  cab.height = 28;

  const idxSit = t.cab.indexOf('Situação');
  t.linhas.forEach((l, k) => {
    const row = ws.getRow(linhaCab + 1 + k);
    const ehTotal = String(l[0]).startsWith('Total geral');
    l.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v === '' ? null : v;
      c.border = bordas;
      c.font = { name: 'Calibri', size: 10.5, bold: ehTotal };
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: typeof v === 'number' ? 'center' : 'left' };
      if (k % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFD' } };
      if (ehTotal) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CLARA } };
    });
    if (idxSit >= 0 && H.COR[l[idxSit]]) {
      const c = row.getCell(idxSit + 1);
      c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: argb(H.COR[l[idxSit]]) } };
    }
    row.height = 20;
  });
  if (!t.linhas.length) {
    ws.mergeCells(`A${linhaCab + 1}:${ultima}${linhaCab + 1}`);
    ws.getCell(`A${linhaCab + 1}`).value = 'Nenhum registro para os filtros selecionados.';
    ws.getCell(`A${linhaCab + 1}`).alignment = { horizontal: 'center' };
  } else {
    const fimDados = linhaCab + t.linhas.length - (String(t.linhas[t.linhas.length - 1][0]).startsWith('Total geral') ? 1 : 0);
    ws.autoFilter = { from: { row: linhaCab, column: 1 }, to: { row: Math.max(fimDados, linhaCab + 1), column: nCols } };
  }

  // congela até o cabeçalho da tabela; repete o cabeçalho ao imprimir; rodapé com paginação
  ws.views = [{ state: 'frozen', ySplit: linhaCab, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${linhaCab}:${linhaCab}`;
  ws.headerFooter.oddFooter = '&LColégio Estadual Mendes Gonçalves&RPágina &P de &N';
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { gerarXlsx };
