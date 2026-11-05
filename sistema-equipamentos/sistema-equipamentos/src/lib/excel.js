// Geração de planilhas .xlsx padronizadas (logo + cores do Colégio Estadual Mendes Gonçalves)
const path = require('path');
const ExcelJS = require('exceljs');

const AZUL = 'FF3E4095';     // azul da logo
const AMARELO = 'FFFFF112';  // amarelo da logo
const ZEBRA = 'FFEEEFF8';
const LOGO = path.join(__dirname, '..', '..', 'public', 'img', 'logo-mendes.png');

const COR_SITUACAO = {
  'Disponível': 'FFD6F0E0', 'Em utilização': 'FFDCEAFB', 'Em manutenção': 'FFFFF1C7',
  'Defeituoso': 'FFF8D7D7', 'Inativo': 'FFE5E7EB', 'Baixado do patrimônio': 'FFD1D5DB',
};
const letra = (n) => { let s = ''; let x = n; while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); } return s; };

/**
 * t = { titulo, cab: string[], linhas: any[][], totalUltima?: boolean }
 * meta = { usuario, filtros: string }
 */
async function gerarXlsx(t, meta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gerenciamento de Equipamentos';
  const ws = wb.addWorksheet(t.titulo.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: t.cab.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const nCols = t.cab.length;
  const ultima = letra(nCols);

  // largura de cada coluna conforme o conteúdo (mín. 12, máx. 45)
  ws.columns = t.cab.map((c, i) => {
    const maior = Math.max(String(c).length, ...t.linhas.map((l) => String(l[i] ?? '').length));
    return { width: Math.min(45, Math.max(12, maior + 3)) };
  });

  // Faixa do topo: logo + nome da escola + título
  [1, 2, 3].forEach((r) => { ws.getRow(r).height = 24; });
  const logo = ExcelJS.Workbook ? wb.addImage({ filename: LOGO, extension: 'png' }) : null;
  ws.addImage(logo, { tl: { col: 0.15, row: 0.1 }, ext: { width: 80, height: 76 } });
  const colTexto = nCols >= 3 ? 'C' : 'B';
  ws.mergeCells(`${colTexto}1:${ultima}1`);
  ws.getCell(`${colTexto}1`).value = 'Colégio Estadual Mendes Gonçalves';
  ws.getCell(`${colTexto}1`).font = { name: 'Calibri', size: 18, bold: true, color: { argb: AZUL } };
  ws.mergeCells(`${colTexto}2:${ultima}2`);
  ws.getCell(`${colTexto}2`).value = t.titulo;
  ws.getCell(`${colTexto}2`).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1F2937' } };
  ws.mergeCells(`${colTexto}3:${ultima}3`);
  ws.getCell(`${colTexto}3`).value = `Gerado em ${new Date().toLocaleString('pt-BR')}${meta.usuario ? ` por ${meta.usuario}` : ''}`;
  ws.getCell(`${colTexto}3`).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
  ['1', '2', '3'].forEach((r) => { ws.getCell(`${colTexto}${r}`).alignment = { vertical: 'middle' }; });

  // Linha amarela decorativa + linha de filtros
  ws.getRow(4).height = 4;
  for (let c = 1; c <= nCols; c += 1) ws.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARELO } };
  ws.mergeCells(`A5:${ultima}5`);
  ws.getCell('A5').value = `Filtros: ${meta.filtros || 'nenhum (todos os registros)'}   |   Total de registros: ${t.linhas.length - (t.totalUltima ? 1 : 0)}`;
  ws.getCell('A5').font = { name: 'Calibri', size: 10, color: { argb: 'FF4B5563' } };
  ws.getCell('A5').alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(5).height = 20;

  // Cabeçalho da tabela
  const cab = ws.getRow(6);
  cab.values = t.cab; cab.height = 28;
  cab.eachCell((c) => {
    c.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'medium', color: { argb: AMARELO } } };
  });

  // Dados
  const iSit = t.cab.indexOf('Situação');
  t.linhas.forEach((l, i) => {
    const r = ws.addRow(l);
    const ehTotal = t.totalUltima && i === t.linhas.length - 1;
    r.height = 20;
    r.eachCell({ includeEmpty: true }, (c, col) => {
      if (col > nCols) return;
      c.font = { name: 'Calibri', size: 10.5, bold: ehTotal, color: { argb: ehTotal ? AZUL : 'FF1F2937' } };
      c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'number' ? 'center' : 'left', wrapText: true, indent: typeof c.value === 'number' ? 0 : 1 };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE0E3EC' } } };
      if (ehTotal) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARELO } };
      else if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
    if (iSit >= 0 && COR_SITUACAO[l[iSit]]) {
      const c = r.getCell(iSit + 1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_SITUACAO[l[iSit]] } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  const fimFiltro = t.linhas.length - (t.totalUltima ? 1 : 0);
  if (fimFiltro > 0) ws.autoFilter = { from: 'A6', to: `${ultima}${6 + fimFiltro}` };
  ws.headerFooter.oddFooter = '&LColégio Estadual Mendes Gonçalves&RPágina &P de &N';
  return wb.xlsx.writeBuffer();
}

module.exports = { gerarXlsx };
