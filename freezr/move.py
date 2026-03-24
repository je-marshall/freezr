import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('move', __name__, url_prefix='/move')

@bp.route('/about', methods=('GET', 'POST'))
@login_required
def about():
    if request.method == 'POST':
        entry_id = request.form['entry_id']
        new_freezer = request.form['freezer_id']
        new_drawer = request.form['drawer']
        
        db = get_db()
        error = None
        
        if not entry_id:
            error = 'You must select an item to move.'
        elif not new_freezer:
            error = 'New freezer location is required.'
        elif not new_drawer:
            error = 'New drawer location is required.'
            
        if error is None:
            db.execute(
                'UPDATE entries SET freezer_id = ?, drawer = ? WHERE id = ? AND auth_id = ?',
                (new_freezer, new_drawer, entry_id, g.user['id'])
            )
            db.commit()
            return redirect(url_for('index.index'))
            
        flash(error)
    return render_template('move/about.html')
