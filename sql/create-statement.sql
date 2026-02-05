CREATE TABLE auth_organization_tbl (
  org_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_name TEXT NOT NULL,
  org_address TEXT,
  org_state TEXT,
  org_country TEXT,
  org_external_id TEXT,
  org_is_deleted INTEGER DEFAULT 0,
  org_created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_external_id)
);

CREATE TABLE auth_users_tbl (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL UNIQUE,
  user_mobile_no TEXT,
  user_password_hash TEXT NOT NULL,
  user_fname TEXT,
  user_lname TEXT,
  user_is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_organization_users_tbl (
  org_user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  org_user_role_id INTEGER DEFAULT 0,
  org_user_is_active INTEGER DEFAULT 1,
  user_opinion INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, user_id)
);

CREATE TABLE auth_invited_users_tbl (
  invited_users_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER,
  email TEXT,
  invited_user_role_id INTEGER DEFAULT 0,
  invited_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0,
  UNIQUE (org_id, email, is_deleted)
);

CREATE TABLE b_transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  z_order_id TEXT,
  user_id INTEGER NOT NULL,
  z_payment_id TEXT,
  z_payment_signature TEXT,
  z_payment_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  z_currency TEXT,
  z_payment_method TEXT,
  z_error_code TEXT,
  z_error_description TEXT,
  z_error_reason TEXT,
  amount TEXT,
  status TEXT DEFAULT 'idle'
);

CREATE TABLE b_purchased_plans (
  purchased_id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  for_months INTEGER,
  for_no_users TEXT,
  y_billing_name TEXT,
  y_billing_country TEXT,
  y_billing_address TEXT,
  y_billing_email TEXT,
  y_billing_contact_no TEXT
);

CREATE TABLE b_updated_plans (
  updated_plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  purchased_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  for_no_users TEXT
);

-- Need to create triggers if required.

CREATE TABLE c_countries (
  country_code TEXT PRIMARY KEY,
  country_name TEXT
);
INSERT INTO c_countries (country_code, country_name) VALUES
('AFG','Afghanistan'),
('AUS','Australia'),
('AUT','Austria'),
('BEL','Belgium'),
('BRA','Brazil'),
('CAN','Canada'),
('CHE','Switzerland'),
('CHN','China'),
('DEU','Germany'),
('DNK','Denmark'),
('ESP','Spain'),
('FIN','Finland'),
('FRA','France'),
('GBR','United Kingdom'),
('HKG','Hong Kong'),
('IDN','Indonesia'),
('IND','India'),
('IRL','Ireland'),
('ISR','Israel'),
('ITA','Italy'),
('JPN','Japan'),
('KOR','South Korea'),
('MEX','Mexico'),
('NLD','Netherlands'),
('NOR','Norway'),
('NZL','New Zealand'),
('PAK','Pakistan'),
('PHL','Philippines'),
('RUS','Russia'),
('SAU','Saudi Arabia'),
('SGP','Singapore'),
('SWE','Sweden'),
('THA','Thailand'),
('TUR','Turkey'),
('UAE','United Arab Emirates'),
('USA','United States'),
('VNM','Vietnam'),
('ZAF','South Africa');
