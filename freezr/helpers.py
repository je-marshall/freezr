from freezr.db import get_db
import datetime

def get_all_entries():
    '''
    Returns a list of all entries in the db
    '''
    db = get_db()
    all_entries = db.execute('SELECT e.id, e.created, e.quantity, e.skin, e.bone, '
                             'e.minced, e.grated, e.cooked, '
                             'c.category, s.subcat, u.subsub '
                             'FROM entries e '
                             'JOIN categories c ON e.category_id = c.id '
                             'JOIN subcats s ON e.subcat_id = s.id '
                             'JOIN subsub u ON e.subsub = u.id '
                             'ORDER BY e.created').fetchall()
    return all_entries

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
        desc_string += f'{entry["subcat"]} {entry["subsub"]}'
        entry['desc'] = desc_string
        age = (datetime.datetime.now() - entry['created'])
        entry['age'] = f'{age.days} days'
        return entries
