import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('checkout', __name__, url_prefix='/checkout')

@bp.route('/out', methods=['POST'])
@login_required
def checkout():
    entry_id = request.form.get('entry_id')
    db = get_db()
    error = None
    
    if not entry_id:
        error = 'You must select an item to check out.'
        
    if error is None:
        # We use auth_id in the WHERE clause so users can only delete their own items
        db.execute(
            'DELETE FROM entries WHERE id = ? AND auth_id = ?',
            (entry_id, g.user['id'])
        )
        db.commit()
        return redirect(url_for('index.index'))
        
    flash(error)
    return redirect(url_for('index.index'))
