require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const H = require('./lib/helpers');
const icon = require('./lib/icons');
const { requireAuth, csrf } = require('./middleware/auth');

const app = express();
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
    },
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'troque-este-valor') {
  console.warn('[aviso] Defina um SESSION_SECRET forte no arquivo .env');
}
app.use(session({
  name: 'cemg.sid',
  secret: process.env.SESSION_SECRET || 'dev-somente-local',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 },
}));

// Variáveis e funções disponíveis em todas as views
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

app.use(require('./routes/auth'));
app.use(requireAuth);
app.use('/', require('./routes/dashboard'));
app.use('/equipamentos', require('./routes/equipamentos'));
app.use('/setores', require('./routes/setores'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/relatorios', require('./routes/relatorios'));

app.use((req, res) => res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'O endereço acessado não existe.', active: '' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('erro', { titulo: 'Erro inesperado', mensagem: 'Algo deu errado. Tente novamente em instantes.', active: '' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Sistema em execução: http://localhost:${port}`));
