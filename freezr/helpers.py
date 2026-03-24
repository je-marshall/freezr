import datetime
from flask import g
from werkzeug.exceptions import abort
from freezr.db import get_db

def get_all_entries():
    '''
    Returns a list of all entries in the db
    '''
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
        ORDER BY e.created DESC
    ''').fetchall()
    return all_entries

def get_entry(id, check_author=True):
    '''
    Gets a single entry by its ID, useful for checking out or moving items.
    '''
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
    '''
    Takes a list of rows and generates human readable descriptions of an entry.
    Returns a list of tuples of entry id and description
    '''
    for entry in entries:
        desc_string = f'{entry["quantity"]}x '
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
        
        # Subsub is now optional, so we only append it if it exists
        if entry["subsub"]:
            desc_string += f' {entry["subsub"]}'
            
        entry['desc'] = desc_string
        
        # Create a human readable location string
        entry['location'] = f"{entry['freezer_name']} - Drawer {entry['drawer']}"
        
        # Calculate age in days
        age = (datetime.datetime.now() - entry['created']).days
        entry['age'] = f"{age} days old" if age > 0 else "Added today"
        
    return entries
