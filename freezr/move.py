import functools
from flask import (
    Blueprint, flash, g, redirect, request, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('move', __name__, url_prefix='/move')

@bp.route('/do', methods=['POST'])
@login_required
def move():
    entry_id = request.form.get('entry_id')
    freezer_id = request.form.get('freezer')
    drawer = request.form.get('drawer')
    
    db = get_db()
    error = None
    
    if not entry_id or not freezer_id or not drawer:
        error = 'You must select an item, a freezer, and a drawer.'
        
    if error is None:
        # Update the specific item making sure it belongs to the logged in user
        db.execute(
            'UPDATE entries SET freezer_id = ?, drawer = ? WHERE id = ? AND auth_id = ?',
            (freezer_id, drawer, entry_id, g.user['id'])
        )
        db.commit()
        return redirect(url_for('index.index'))
        
    flash(error)
    return redirect(url_for('index.index'))
