import datetime
import json
import os
from flask import g, current_app
from werkzeug.exceptions import abort
from freezr.db import get_db

def get_all_entries():
    db = get_db()
    all_entries = db.execute('''
        SELECT e.id, e.created, e.quantity, e.skin, e.bone, 
               e.minced, e.grated, e.cooked, e.notes, e.auth_id,
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
        SELECT e.id, e.created, e.quantity, e.skin, e.bone, 
               e.minced, e.grated, e.cooked, e.notes, e.auth_id,
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

def generate_description(entries):
    for entry in entries:
        qty = str(entry["quantity"])
        desc_string = (qty + 'x ') if qty.isdigit() else (qty + ' ')
        if entry['skin']:
            desc_string += 'skin on '
        if entry['bone']:
            desc_string += 'bone in '
        if entry['minced']:
            desc_string += 'minced '
        if entry['grated']:
            desc_string += 'grated '
        if entry['cooked']:
            desc_string += 'cooked '
        
        desc_string += f'{entry["subcat"]}'
        if entry["subsub"]:
            desc_string += f' {entry["subsub"]}'
            
        entry['desc'] = desc_string
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
        for subcat_name, subsubs in subcats.items():
            s_cursor = db.execute('INSERT INTO subcats (subcat, category_id, auth_id) VALUES (?, ?, ?)', (subcat_name, cat_id, user_id))
            subcat_id = s_cursor.lastrowid
            for subsub_name in subsubs:
                db.execute('INSERT INTO subsub (subsub, subcat_id, auth_id) VALUES (?, ?, ?)', (subsub_name, subcat_id, user_id))
    db.commit()
