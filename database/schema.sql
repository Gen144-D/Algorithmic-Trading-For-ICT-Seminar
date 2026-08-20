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
  peak_equity   DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extended user profile / onboarding
CREATE TABLE IF NOT EXISTS profiles (
  user_id           VARCHAR(36) PRIMARY KEY,
  experience        VARCHAR(20),              -- beginner | intermediate | advanced
  risk_profile      VARCHAR(20),              -- conservative | balanced | aggressive
  preferred_markets JSON,
  two_factor_secret VARCHAR(64),
  two_factor_enabled TINYINT(1) DEFAULT 0,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

-- Bots wrap a strategy with runtime configuration and a lifecycle state.
CREATE TABLE IF NOT EXISTS bots (
  id                 VARCHAR(36) PRIMARY KEY,
  user_id            VARCHAR(36) NOT NULL,
  strategy_id        VARCHAR(36) NOT NULL,
  name               VARCHAR(150) NOT NULL,
  mode               ENUM('paper','live') NOT NULL DEFAULT 'paper',
  status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  config             JSON,             -- capital, sessions, auto-sizing, trailing, daily-loss guard
  source             VARCHAR(20) NOT NULL DEFAULT 'custom',   -- custom | marketplace
  marketplace_item_id VARCHAR(36),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trades (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  strategy_id   VARCHAR(36),
  bot_id        VARCHAR(36),
  symbol        VARCHAR(20) NOT NULL,
  side          ENUM('BUY','SELL') NOT NULL,
  quantity      DECIMAL(15,6) NOT NULL,
  price         DECIMAL(15,6) NOT NULL,       -- entry price (backward compat)
  entry_price   DECIMAL(15,6) NOT NULL,
  exit_price    DECIMAL(15,6) NULL,
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

-- Parameter optimization runs (grid search + walk-forward)
CREATE TABLE IF NOT EXISTS optimizations (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  strategy_id   VARCHAR(36),
  symbol        VARCHAR(20) NOT NULL,
  timeframe     VARCHAR(10) NOT NULL,
  param_space   JSON NOT NULL,
  results       JSON NOT NULL,          -- ranked parameter sets
  walk_forward  JSON,
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

-- Bot / strategy marketplace
CREATE TABLE IF NOT EXISTS marketplace_items (
  id            VARCHAR(36) PRIMARY KEY,
  creator_id    VARCHAR(36),
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  symbol        VARCHAR(20) NOT NULL,
  timeframe     VARCHAR(10) NOT NULL DEFAULT '1h',
  rules         JSON NOT NULL,
  risk          JSON NOT NULL,
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_free       TINYINT(1) NOT NULL DEFAULT 1,
  rating        DECIMAL(3,2) DEFAULT 0,
  rating_count  INT NOT NULL DEFAULT 0,
  installs      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_installs (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  item_id    VARCHAR(36) NOT NULL,
  bot_id     VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_item (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE
);

-- Price / condition alerts
CREATE TABLE IF NOT EXISTS alerts (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  symbol      VARCHAR(20) NOT NULL,
  type        VARCHAR(20) NOT NULL,     -- price | indicator
  `condition`   JSON NOT NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  triggered_at TIMESTAMP NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trading journal notes on trades
CREATE TABLE IF NOT EXISTS journal_notes (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  trade_id   VARCHAR(36) NOT NULL,
  note       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

-- Broker connections (encrypted credentials, scoped permissions)
CREATE TABLE IF NOT EXISTS broker_connections (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  broker          VARCHAR(30) NOT NULL,          -- alpaca | paper | ...
  label           VARCHAR(100),
  credentials_enc TEXT,                          -- AES-256-GCM encrypted
  permissions     JSON,                          -- { read:true, trade:false, marketData:true }
  mode            ENUM('paper','live') NOT NULL DEFAULT 'paper',
  live_enabled    TINYINT(1) NOT NULL DEFAULT 0, -- explicit live kill-switch
  status          VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);