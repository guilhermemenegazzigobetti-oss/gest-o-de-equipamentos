-- =====================================================================
-- Sistema de Gerenciamento de Equipamentos - Laboratórios de Informática
-- Colégio Estadual Mendes Gonçalves • Guaíra - PR
-- MySQL 8 • Script de criação das tabelas (execute antes de dados.sql)
-- =====================================================================
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS equipamentos_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE equipamentos_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS historico_equipamentos;
DROP TABLE IF EXISTS equipamentos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS setores;
DROP TABLE IF EXISTS usuarios;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE usuarios (
  id_usuario    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL,           -- bcrypt, nunca texto puro
  perfil        ENUM('administrador','operador','consulta') NOT NULL DEFAULT 'consulta',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE setores (
  id_setor    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(120) NOT NULL,
  descricao   VARCHAR(255) NULL,
  localizacao VARCHAR(120) NOT NULL,
  responsavel VARCHAR(120) NULL,
  ativo       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_setor),
  UNIQUE KEY uq_setores_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE categorias (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(80) NOT NULL,
  descricao    VARCHAR(255) NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categorias_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE equipamentos (
  id_equipamento    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_patrimonio VARCHAR(30) NULL,            -- único quando informado (vários NULL permitidos)
  nome              VARCHAR(120) NOT NULL,
  id_categoria      INT UNSIGNED NOT NULL,
  marca             VARCHAR(60) NULL,
  modelo            VARCHAR(60) NULL,
  numero_serie      VARCHAR(60) NULL,
  id_setor          INT UNSIGNED NOT NULL,
  data_aquisicao    DATE NULL,
  situacao          ENUM('Disponível','Em utilização','Em manutenção','Defeituoso','Inativo','Baixado do patrimônio')
                    NOT NULL DEFAULT 'Disponível',
  observacoes       TEXT NULL,
  ativo             TINYINT(1) NOT NULL DEFAULT 1,  -- desativação lógica (RN05)
  data_cadastro     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  id_usuario_cadastro INT UNSIGNED NULL,
  PRIMARY KEY (id_equipamento),
  UNIQUE KEY uq_equip_patrimonio (numero_patrimonio),
  KEY idx_equip_setor (id_setor),
  KEY idx_equip_categoria (id_categoria),
  KEY idx_equip_situacao (situacao),
  CONSTRAINT fk_equip_categoria FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria),
  CONSTRAINT fk_equip_setor     FOREIGN KEY (id_setor)     REFERENCES setores (id_setor),
  CONSTRAINT fk_equip_usuario   FOREIGN KEY (id_usuario_cadastro) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE historico_equipamentos (
  id_historico      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_equipamento    INT UNSIGNED NOT NULL,
  id_usuario        INT UNSIGNED NOT NULL,
  situacao_anterior VARCHAR(30) NULL,            -- NULL = cadastro inicial
  situacao_nova     VARCHAR(30) NOT NULL,
  justificativa     VARCHAR(500) NOT NULL,
  data_alteracao    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historico),
  KEY idx_hist_equip (id_equipamento, data_alteracao),
  CONSTRAINT fk_hist_equip   FOREIGN KEY (id_equipamento) REFERENCES equipamentos (id_equipamento),
  CONSTRAINT fk_hist_usuario FOREIGN KEY (id_usuario)     REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;
