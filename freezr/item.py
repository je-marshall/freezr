from flask import Blueprint, render_template, g
from freezr.auth import login_required
from freezr.helpers import get_entry, generate_description
from freezr.db import get_db

bp = Blueprint('item', __name__)

@bp.route('/item/<int:id>')
@login_required
def item(id):
    entry = get_entry(id)
    generate_description([entry])
    db = get_db()
    freezers = db.execute('SELECT * FROM freezers WHERE auth_id = ?', (g.user['id'],)).fetchall()
    return render_template('item.html', entry=entry, freezers=freezers)
