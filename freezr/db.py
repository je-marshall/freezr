import sqlite3
import click
import secrets
import string
from datetime import datetime
from flask import current_app, g
from werkzeug.security import generate_password_hash

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect( \
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = dict_factory
    return g.db

def dict_factory(cursor, row):
    fields = [column[0] for column in cursor.description]
    return {key:value for key, value in zip(fields, row)}

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(debug=False):
    from freezr.helpers import seed_default_categories

    db = get_db()
    with current_app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf8'))

    alphabet = string.ascii_letters + string.digits
    password = ''.join(secrets.choice(alphabet) for i in range(12))

    cursor = db.execute(
        'INSERT INTO user (username, password) VALUES (?, ?)',
        ('freezr', generate_password_hash(password))
    )
    user_id = cursor.lastrowid

    db.execute(
        "INSERT INTO freezers (name, drawers, location, auth_id) VALUES (?, ?, ?, ?)",
        ('Kitchen Freezer', 4, 'Kitchen', user_id)
    )
    seed_default_categories(user_id)

    click.echo("\n" + "="*60)
    click.echo(" FREEZR READY")
    click.echo(f" Password : {password}")
    click.echo(" Note this down — it won't be shown again.")
    click.echo("="*60 + "\n")
    
    # If debug mode is on, insert dummy entries for the admin user
    if debug:
        dummy_entries = [
            (1, 2, 8, 1, 1, 0, 0, 0, 0, 0, 'For the curry on Friday', 4, 1),
            (1, 3, 16, 2, 3, 1, 1, 0, 0, 0, 'Bone-in chops from the butcher', 2, 1),
            (1, 2, 13, 4, 1, 1, 1, 0, 0, 0, 'Sunday roast', 1, 1)
        ]
        
        db.executemany(
            '''INSERT INTO entries 
               (category_id, subcat_id, subsub, freezer_id, drawer, skin, bone, minced, grated, cooked, notes, quantity, auth_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            dummy_entries
        )

    db.commit()

@click.command('init-db')
@click.option('--debug', is_flag=True, help='Initialise the database with dummy data.')
def init_db_command(debug):
    """Clear the existing data and create new tables."""
    init_db(debug)
    click.echo('Initialized the database.')

@click.command('reset-password')
@click.argument('password', required=False)
def reset_password_command(password):
    """Reset the Freezr login password. Generates a random one if no password given."""
    if not password:
        alphabet = string.ascii_letters + string.digits
        password = ''.join(secrets.choice(alphabet) for i in range(12))
        generated = True
    else:
        generated = False

    db = get_db()
    db.execute('UPDATE user SET password = ? WHERE id = 1',
               (generate_password_hash(password),))
    db.commit()

    if generated:
        click.echo(f"\nNew password: {password}\n")
    else:
        click.echo("\nPassword updated.\n")

def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(reset_password_command)

    with app.app_context():
        db = get_db()
        for stmt in [
            'ALTER TABLE settings ADD COLUMN base_url TEXT',
        ]:
            try:
                db.execute(stmt)
                db.commit()
            except Exception:
                pass
