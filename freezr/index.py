from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from werkzeug.exceptions import abort
from freezr.auth import login_required
from freezr.db import get_db
from freezr.helpers import (get_all_entries, get_entry, generate_description)

bp = Blueprint('index', __name__)

@bp.route('/')
@login_required
def index():
    db = get_db()
    all_entries = get_all_entries()
    generate_description(all_entries)
    
    # Fetch data to populate the modal's dynamic dropdown menus
    categories = db.execute('SELECT * FROM categories').fetchall()
    subcats = db.execute('SELECT * FROM subcats').fetchall()
    subsubs = db.execute('SELECT * FROM subsub').fetchall()
    freezers = db.execute('SELECT * FROM freezers').fetchall()
    
    return render_template('main.html', entries=all_entries, categories=categories, 
                           subcats=subcats, subsubs=subsubs, freezers=freezers)

@bp.route('/item/<int:id>')
@login_required
def item(id):
    entry = get_entry(id)
    if entry is None:
        abort(404, f"Entry id {id} doesn't exist.")
    generate_description([entry])
    return render_template('item.html', entry=entry)
