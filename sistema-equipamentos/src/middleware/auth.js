// RN10: áreas administrativas exigem sessão válida e permissão compatível
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.method === 'GET' ? req.originalUrl : '/';
  return res.redirect('/login');
}

function requireRole(...perfis) {
  return (req, res, next) => {
    if (perfis.includes(req.session.user.perfil)) return next();
    return res.status(403).render('erro', {
      titulo: 'Acesso negado', mensagem: 'Seu perfil não tem permissão para esta operação.', active: '',
    });
  };
}

// Proteção CSRF: token por sessão, enviado em campo oculto nos formulários
const crypto = require('crypto');
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const t = req.body && req.body._csrf;
    const ok = t && t.length === req.session.csrf.length &&
      crypto.timingSafeEqual(Buffer.from(t), Buffer.from(req.session.csrf));
    if (!ok) {
      return res.status(403).render('erro', {
        titulo: 'Sessão expirada', mensagem: 'Não foi possível validar o formulário. Recarregue a página e tente novamente.', active: '',
      });
    }
  }
  return next();
}

const podeEditar = ['administrador', 'operador'];
module.exports = { requireAuth, requireRole, csrf, podeEditar };
