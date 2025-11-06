DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS subcats;
DROP TABLE IF EXISTS subsub;
DROP TABLE IF EXISTS entries;


CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT UNIQUE NOT NULL
);

CREATE TABLE subcats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories (id),
    subcat TEXT NOT NULL
);

CREATE TABLE subsub (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subcat_id INTEGER NOT NULL REFERENCES subcats (id),
    subsub TEXT NOT NULL
);

CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories (id),
    subcat_id INTEGER NOT NULL REFERENCES subcats (id),
    subsub INTEGER NOT NULL REFERENCES subsub (id),
    skin BOOLEAN NOT NULL CHECK (skin IN (0, 1)) DEFAULT 0,
    bone BOOLEAN NOT NULL CHECK (bone IN (0, 1)) DEFAULT 0,
    minced BOOLEAN NOT NULL CHECK (minced IN (0, 1)) DEFAULT 0,
    grated BOOLEAN NOT NULL CHECK (grated IN (0, 1)) DEFAULT 0,
    cooked BOOLEAN NOT NULL CHECK (cooked IN (0, 1)) DEFAULT 0,
    notes TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auth_id INTEGER NOT NULL REFERENCES user (id)
);

INSERT INTO categories (id, category)
    VALUES (1, 'meat'),
           (2, 'dairy'),
           (3, 'bread'),
           (4, 'seafood'),
           (5, 'meal');

INSERT INTO subcats (category_id, id, subcat)
    VALUES (1, 1, 'sausages'),
           (1, 2, 'chicken'),
           (1, 3, 'pork'),
           (1, 4, 'beef'),
           (1, 5, 'veal'),
           (1, 6, 'turkey'),
           (1, 7, 'duck'),
           (1, 8, 'goose'),
           (2, 9, 'cheese'),
           (2, 10, 'cream'),
           (2, 11, 'milk'),
           (3, 12, 'loaf'),
           (3, 13, 'bun'),
           (3, 14, 'croissant'),
           (4, 15, 'fish'),
           (4, 16, 'prawns'),
           (4, 17, 'squid'),
           (4, 18, 'octopus'),
           (5, 19, 'stock'),
           (5, 20, 'papillotes'),
           (5, 21, 'terrine');

INSERT INTO subsub (subcat_id, id, subsub)
    VALUES (1, NULL, 'diot'),
           (1, NULL, 'morteau'),
           (1, NULL, 'espellete'),
           (1, NULL, 'mergeuz'),
           (1, NULL, 'cumberland'),
           (1, NULL, 'lincoln'),
           (1, NULL, 'pork'),
           (2, NULL, 'breast'),
           (2, NULL, 'wing'),
           (2, NULL, 'leg'),
           (2, NULL, 'thigh'),
           (2, NULL, 'supreme'),
           (2, NULL, 'whole'),
           (2, NULL, 'giblets'),
           (2, NULL, 'liver'),
           (3, NULL, 'chop'),
           (3, NULL, 'tenderloin'),
           (3, NULL, 'shoulder'),
           (3, NULL, 'belly'),
           (3, NULL, 'cutlet'),
           (3, NULL, 'ribs'),
           (3, NULL, 'neck'),
           (3, NULL, 'leg'),
           (3, NULL, 'hock');
