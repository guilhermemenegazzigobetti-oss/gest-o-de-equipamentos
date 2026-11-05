const crypto = require('crypto');
const db = require('../db');

// Revalida estado e perfil no banco em toda requisição autenticada.
// Isso invalida imediatamente sessões de contas desativadas e atualiza mudanças de perfil.
async function requireAuth(req, res, next) {
  try {
    if (!req.session || !req.session.user) {
      if (req.session) req.session.returnTo = req.method === 'GET' ? req.originalUrl : '/';
      return res.redirect('/login');
    }
    const [rows] = await db.query(
      'SELECT id_usuario, nome, email, perfil, ativo FROM usuarios WHERE id_usuario = ? LIMIT 1',
      [req.session.user.id],
    );
    const atual = rows[0];
    if (!atual || !atual.ativo) {
      return req.session.destroy(() => {
        res.clearCookie('cemg.sid', { path: '/' });
        res.redirect('/login');
      });
    }
    req.session.user = { id: atual.id_usuario, nome: atual.nome, email: atual.email, perfil: atual.perfil };
    return next();
  } catch (error) { return next(error); }
}

function requireRole(...perfis) {
  return (req, res, next) => {
    if (req.session && req.session.user && perfis.includes(req.session.user.perfil)) return next();
    return res.status(403).render('erro', {
      titulo: 'Acesso negado', mensagem: 'Seu perfil não tem permissão para esta operação.', active: '',
    });
  };
}

const cryptoCsrf = require('crypto');
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = cryptoCsrf.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.body && req.body._csrf;
    const esperado = req.session.csrf;
    const valido = typeof token === 'string'
      && /^[a-f0-9]{64}$/i.test(token)
      && typeof esperado === 'string'
      && /^[a-f0-9]{64}$/i.test(esperado)
      && cryptoCsrf.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(esperado, 'hex'));
    if (!valido) {
      return res.status(403).render('erro', {
        titulo: 'Sessão expirada', mensagem: 'Não foi possível validar o formulário. Recarregue a página e tente novamente.', active: '',
      });
    }
  }
  return next();
}

// Limite complementar simples para rotas de exportação; o limite principal de login é persistido no MySQL.
const podeEditar = ['administrador', 'operador'];
module.exports = { requireAuth, requireRole, csrf, podeEditar };
