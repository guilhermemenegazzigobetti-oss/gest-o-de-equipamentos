const session = require('express-session');

// Store de sessões persistente no MySQL. Não armazena dados de sessão em memória.
class MySQLSessionStore extends session.Store {
  constructor(pool, options = {}) {
    super();
    this.pool = pool;
    this.table = options.table || 'sessoes';
    this.defaultTtl = options.ttl || 4 * 60 * 60 * 1000;
  }

  async get(sid, callback) {
    try {
      const [rows] = await this.pool.query(
        `SELECT dados FROM ${this.table} WHERE id_sessao = ? AND expira_em > ? LIMIT 1`,
        [sid, Date.now()],
      );
      if (!rows.length) return callback(null, null);
      try { return callback(null, JSON.parse(rows[0].dados)); }
      catch (_) { await this.destroy(sid, () => {}); return callback(null, null); }
    } catch (error) { return callback(error); }
  }

  async set(sid, sess, callback = () => {}) {
    try {
      const expira = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.defaultTtl;
      await this.pool.query(
        `INSERT INTO ${this.table} (id_sessao, expira_em, dados) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expira_em = VALUES(expira_em), dados = VALUES(dados)`,
        [sid, expira, JSON.stringify(sess)],
      );
      callback(null);
    } catch (error) { callback(error); }
  }

  async touch(sid, sess, callback = () => {}) {
    try {
      const expira = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.defaultTtl;
      await this.pool.query(`UPDATE ${this.table} SET expira_em = ? WHERE id_sessao = ?`, [expira, sid]);
      callback(null);
    } catch (error) { callback(error); }
  }

  async destroy(sid, callback = () => {}) {
    try { await this.pool.query(`DELETE FROM ${this.table} WHERE id_sessao = ?`, [sid]); callback(null); }
    catch (error) { callback(error); }
  }

  async clearExpired() {
    await this.pool.query(`DELETE FROM ${this.table} WHERE expira_em <= ?`, [Date.now()]);
  }
}

module.exports = MySQLSessionStore;
