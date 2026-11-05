require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const db = require('./db');
const MySQLSessionStore = require('./lib/mysql-session-store');
const H = require('./lib/helpers');
const icon = require('./lib/icons');
const { requireAuth, csrf } = require('./middleware/auth');

const app = express();
const emProducao = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || '';
if (Buffer.byteLength(sessionSecret, 'utf8') < 64) {
  throw new Error('SESSION_SECRET ausente ou fraco. Gere pelo menos 32 bytes aleatórios (64 caracteres hex) e configure no .env.');
}
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: emProducao ? [] : null,
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', index: false, maxAge: emProducao ? '1d' : 0 }));

const store = new MySQLSessionStore(db, { ttl: 4 * 60 * 60 * 1000 });
app.use(session({
  name: 'cemg.sid',
  secret: sessionSecret,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: emProducao,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4,
    path: '/',
  },
}));

// Limpeza periódica de sessões expiradas sem depender de serviço externo.
const cleanup = setInterval(() => {
  store.clearExpired().catch((e) => console.error('[sessões] Falha na limpeza:', e.message));
  db.query('DELETE FROM tentativas_login WHERE inicio_janela < NOW() - INTERVAL 1 DAY').catch((e) => console.error('[login] Falha na limpeza:', e.message));
}, 15 * 60 * 1000);
if (typeof cleanup.unref === 'function') cleanup.unref();

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  Object.assign(res.locals, {
    icon, badge: H.badge, fmtDate: H.fmtDate, fmtDateTime: H.fmtDateTime, esc: H.esc,
    SITUACOES: H.SITUACOES, PERFIS: H.PERFIS, COR: H.COR, active: '', titulo: '',
  });
  next();
});
app.use(csrf);

app.use(require('./routes/auth-routes'));
app.use(requireAuth);
app.use('/', require('./routes/dashboard'));
app.use('/equipamentos', require('./routes/equipamentos'));
app.use('/setores', require('./routes/setores'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/relatorios', require('./routes/relatorios'));

app.use((req, res) => res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'O endereço acessado não existe.', active: '' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Não expor stack trace, SQL, credenciais ou detalhes internos ao navegador.
  console.error('[erro]', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).render('erro', { titulo: 'Requisição muito grande', mensagem: 'Reduza o tamanho dos dados enviados e tente novamente.', active: '' });
  }
  return res.status(500).render('erro', { titulo: 'Erro inesperado', mensagem: 'Algo deu errado. Tente novamente em instantes.', active: '' });
});

async function iniciar() {
  // Falha cedo se a migração ainda não foi aplicada; o usuário de runtime não precisa de CREATE.
  await db.query('SELECT id_sessao FROM sessoes LIMIT 0');
  await db.query('SELECT ip_hash FROM tentativas_login LIMIT 0');
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Sistema em execução na porta ${port}`));
}

iniciar().catch((error) => {
  console.error('[inicialização] Não foi possível iniciar o sistema:', error.message);
  process.exit(1);
});
