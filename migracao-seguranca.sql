-- Migração não destrutiva para instalações já existentes.
USE equipamentos_db;

CREATE TABLE IF NOT EXISTS sessoes (
  id_sessao VARCHAR(128) NOT NULL,
  expira_em BIGINT UNSIGNED NOT NULL,
  dados MEDIUMTEXT NOT NULL,
  PRIMARY KEY (id_sessao),
  KEY idx_sessoes_expira (expira_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tentativas_login (
  ip_hash CHAR(64) NOT NULL,
  login_hash CHAR(64) NOT NULL,
  tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  inicio_janela DATETIME NOT NULL,
  bloqueado_ate DATETIME NULL,
  PRIMARY KEY (ip_hash, login_hash),
  KEY idx_tentativas_inicio (inicio_janela),
  KEY idx_tentativas_bloqueio (bloqueado_ate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Desativa as contas fictícias com senhas padrão distribuídas em versões anteriores.
UPDATE usuarios SET ativo = 0
WHERE email IN (
  'ana.silva@cemg.edu.br',
  'carlos.oliveira@cemg.edu.br',
  'fernanda.lima@cemg.edu.br'
);
