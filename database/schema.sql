-- MySQL schema for the Algorithmic Trading System
-- The backend also supports an in-memory fallback that mirrors this schema.

CREATE DATABASE IF NOT EXISTS trading;
USE trading;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  balance       DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS strategies (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  symbol        VARCHAR(20) NOT NULL,
  timeframe     VARCHAR(10) NOT NULL DEFAULT '1h',
  rules         JSON NOT NULL,          -- indicators + buy/sell conditions
  risk          JSON NOT NULL,          -- stop loss / take profit / position size
  active        TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trades (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  strategy_id   VARCHAR(36),
  symbol        VARCHAR(20) NOT NULL,
  side          ENUM('BUY','SELL') NOT NULL,
  quantity      DECIMAL(15,6) NOT NULL,
  price         DECIMAL(15,6) NOT NULL,
  status        ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  pnl           DECIMAL(15,2) DEFAULT 0,
  opened_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at     TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backtests (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  strategy_id   VARCHAR(36),
  symbol        VARCHAR(20) NOT NULL,
  timeframe     VARCHAR(10) NOT NULL,
  start_date    DATE,
  end_date      DATE,
  result        JSON NOT NULL,          -- P/L, win rate, equity curve, etc.
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_history (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol      VARCHAR(20) NOT NULL,
  timeframe   VARCHAR(10) NOT NULL,
  ts          DATETIME NOT NULL,
  open        DECIMAL(15,6) NOT NULL,
  high        DECIMAL(15,6) NOT NULL,
  low         DECIMAL(15,6) NOT NULL,
  close       DECIMAL(15,6) NOT NULL,
  volume      BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_symbol_tf_ts (symbol, timeframe, ts)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  action     VARCHAR(50) NOT NULL,
  detail     JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
);
