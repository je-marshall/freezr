import datetime
import json
import os
from flask import g, current_app
from werkzeug.exceptions import abort
from freezr.db import get_db

def get_all_entries():
    db = get_db()
    all_entries = db.execute('''
        SELECT e.id, e.created, e.quantity, e.quantity_type, e.skin, e.bone,
               e.minced, e.grated, e.cooked, e.notes, e.auth_id,
               e.category_id, e.subcat_id, e.subsub AS subsub_id, e.freezer_id,
               c.category, s.subcat, u.subsub,
               f.name AS freezer_name, e.drawer
        FROM entries e
        JOIN categories c ON e.category_id = c.id
        JOIN subcats s ON e.subcat_id = s.id
        LEFT JOIN subsub u ON e.subsub = u.id
        JOIN freezers f ON e.freezer_id = f.id
        WHERE e.auth_id = ?
        ORDER BY e.created DESC
    ''', (g.user['id'],)).fetchall()
    return all_entries

def get_entry(id, check_author=True):
    db = get_db()
    entry = db.execute(
        '''
        SELECT e.id, e.created, e.quantity, e.quantity_type, e.skin, e.bone,
               e.minced, e.grated, e.cooked, e.notes, e.auth_id,
               e.category_id, e.subcat_id, e.subsub AS subsub_id, e.freezer_id,
               c.category, s.subcat, u.subsub,
               f.name AS freezer_name, e.drawer
        FROM entries e
        JOIN categories c ON e.category_id = c.id
        JOIN subcats s ON e.subcat_id = s.id
        LEFT JOIN subsub u ON e.subsub = u.id
        JOIN freezers f ON e.freezer_id = f.id
        WHERE e.id = ?
        ''',
        (id,)
    ).fetchone()

    if entry is None:
        abort(404, f"Entry id {id} doesn't exist.")

    if check_author and entry['auth_id'] != g.user['id']:
        abort(403)

    return entry

# Name parts equal to this (case-insensitive) are dropped from descriptions —
# "chicken other" / "beef other" read oddly on a label.
SKIP_NAME_PARTS = {'other'}

PREP_FLAGS = (
    ('skin',   'skin on'),
    ('bone',   'bone in'),
    ('minced', 'minced'),
    ('grated', 'grated'),
    ('cooked', 'cooked'),
)

def build_description(entry):
    """Canonical, human-readable name for an entry (used for both the on-screen
    label and the printed QR label, so they always agree).

    Accepts a sqlite Row or a dict with keys: quantity, skin, bone, minced,
    grated, cooked, subcat, subsub and (optionally) category.
    """
    qty = str(entry['quantity'])
    tokens = [(qty + 'x') if qty.isdigit() else qty]

    for flag, word in PREP_FLAGS:
        if entry[flag]:
            tokens.append(word)

    # Build the item name, dropping any part that is literally "other".
    name_parts = []
    for key in ('subcat', 'subsub'):
        val = (entry[key] or '').strip() if entry[key] is not None else ''
        if val and val.lower() not in SKIP_NAME_PARTS:
            name_parts.append(val)
    if not name_parts:
        # Everything was "other" — fall back so the label is never nameless,
        # preferring the broader category name over a literal "other".
        fallback = ''
        try:
            fallback = (entry['category'] or '').strip()
        except (KeyError, IndexError):
            fallback = ''
        if not fallback:
            fallback = (entry['subcat'] or '').strip()
        if fallback:
            name_parts.append(fallback)
    if name_parts:
        tokens.append(' '.join(name_parts))

    return ' '.join(tokens).strip()

def generate_description(entries):
    for entry in entries:
        entry['desc'] = build_description(entry)
        entry['location'] = f"{entry['freezer_name']} - Drawer {entry['drawer']}"
        
        if isinstance(entry['created'], datetime.datetime):
            entry['date'] = entry['created'].strftime('%Y-%m-%d %H:%M:%S')
        else:
            entry['date'] = str(entry['created'])
        
    return entries

def seed_default_categories(user_id):
    """Reads default categories from a JSON file and inserts them for a new user."""
    db = get_db()
    json_path = os.path.join(current_app.root_path, 'default_categories.json')
    
    try:
        with open(json_path, 'r') as f:
            default_categories = json.load(f)
    except FileNotFoundError:
        # Failsafe if the file is missing
        default_categories = {}

    for cat_name, subcats in default_categories.items():
        c_cursor = db.execute('INSERT INTO categories (category, auth_id) VALUES (?, ?)', (cat_name, user_id))
        cat_id = c_cursor.lastrowid
        for subcat_name, subcat_val in subcats.items():
            if isinstance(subcat_val, dict):
                qty_type = subcat_val.get('qty', 'count')
                subsub_list = subcat_val.get('items', [])
            else:
                qty_type = 'count'
                subsub_list = subcat_val
            s_cursor = db.execute(
                'INSERT INTO subcats (subcat, quantity_type, category_id, auth_id) VALUES (?, ?, ?, ?)',
                (subcat_name, qty_type, cat_id, user_id)
            )
            subcat_id = s_cursor.lastrowid
            for subsub_name in subsub_list:
                db.execute('INSERT INTO subsub (subsub, subcat_id, auth_id) VALUES (?, ?, ?)', (subsub_name, subcat_id, user_id))
    db.commit()
