const SITUACOES = ['Disponível', 'Em utilização', 'Em manutenção', 'Defeituoso', 'Inativo', 'Baixado do patrimônio'];
const PERFIS = { administrador: 'Administrador', operador: 'Operador', consulta: 'Consulta' };
const BADGE = {
  'Disponível': 'b-ok', 'Em utilização': 'b-use', 'Em manutenção': 'b-warn',
  'Defeituoso': 'b-bad', 'Inativo': 'b-off', 'Baixado do patrimônio': 'b-dark',
};
const COR = {
  'Disponível': '#2E9E5B', 'Em utilização': '#2F80ED', 'Em manutenção': '#F2B01E',
  'Defeituoso': '#D64545', 'Inativo': '#9AA3B2', 'Baixado do patrimônio': '#4A5160',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// '2026-10-20' -> '20/10/2026'
const fmtDate = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
// '2026-10-20 09:15:00' -> '20/10/2026 • 09:15'
const fmtDateTime = (s) => (s ? `${fmtDate(s)} • ${String(s).slice(11, 16)}` : '');

const badge = (sit) => `<span class="badge ${BADGE[sit] || 'b-off'}">${esc(sit)}</span>`;

function paginas(atual, total) {
  const set = new Set([1, 2, 3, total, atual - 1, atual, atual + 1].filter((n) => n >= 1 && n <= total));
  const arr = [...set].sort((a, b) => a - b);
  const out = [];
  arr.forEach((n, i) => { if (i && n - arr[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const trimOrNull = (s) => { const t = String(s ?? '').trim(); return t === '' ? null : t; };

module.exports = { SITUACOES, PERFIS, BADGE, COR, esc, fmtDate, fmtDateTime, badge, paginas, isEmail, isDate, trimOrNull };
