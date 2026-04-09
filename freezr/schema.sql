DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS subcats;
DROP TABLE IF EXISTS subsub;
DROP TABLE IF EXISTS freezers;
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS settings;

CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    auth_id INTEGER NOT NULL REFERENCES user (id)
);

CREATE TABLE subcats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories (id),
    subcat TEXT NOT NULL,
    auth_id INTEGER NOT NULL REFERENCES user (id)
);

CREATE TABLE subsub (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subcat_id INTEGER NOT NULL REFERENCES subcats (id),
    subsub TEXT NOT NULL,
    auth_id INTEGER NOT NULL REFERENCES user (id)
);

CREATE TABLE freezers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    drawers INTEGER NOT NULL,
    location TEXT,
    auth_id INTEGER NOT NULL REFERENCES user (id)
);

CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories (id),
    subcat_id INTEGER NOT NULL REFERENCES subcats (id),
    subsub INTEGER REFERENCES subsub (id),
    freezer_id INTEGER NOT NULL REFERENCES freezers (id),
    drawer INTEGER NOT NULL,
    skin BOOLEAN NOT NULL CHECK (skin IN (0, 1)) DEFAULT 0,
    bone BOOLEAN NOT NULL CHECK (bone IN (0, 1)) DEFAULT 0,
    minced BOOLEAN NOT NULL CHECK (minced IN (0, 1)) DEFAULT 0,
    grated BOOLEAN NOT NULL CHECK (grated IN (0, 1)) DEFAULT 0,
    cooked BOOLEAN NOT NULL CHECK (cooked IN (0, 1)) DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    auth_id INTEGER NOT NULL REFERENCES user (id),
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    printer_identifier TEXT NOT NULL,
    printer_model TEXT NOT NULL DEFAULT 'QL-600',
    label_size TEXT NOT NULL DEFAULT '62x29'
);

-- Insert the default USB settings for the Brother QL-600
INSERT INTO settings (id, printer_identifier, printer_model, label_size) VALUES (1, 'usb://0x04f9:0x20c0', 'QL-600', '62x29');
