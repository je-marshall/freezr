import functools
from flask import (
    Blueprint, flash, g, redirect, request, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('freezers', __name__, url_prefix='/freezers')

@bp.route('/add', methods=('POST',))
@login_required
def add():
    name = request.form.get('name')
    drawers = request.form.get('drawers', 1)
    location = request.form.get('location', '')
    
    error = None
    if not name:
        error = 'Freezer name is required.'
    if not drawers:
        error = 'Number of drawers is required.'
        
    if error is None:
        db = get_db()
        db.execute(
            'INSERT INTO freezers (name, drawers, location, auth_id) VALUES (?, ?, ?, ?)',
            (name, int(drawers), location, g.user['id'])
        )
        db.commit()
        flash(f'Freezer "{name}" added successfully!', 'success')
    else:
        flash(error, 'error')
        
    return redirect(url_for('categories.index'))

@bp.route('/edit/<int:id>', methods=('POST',))
@login_required
def edit(id):
    action = request.form.get('action') # Distinguish between 'save' and 'delete'
    db = get_db()
    
    if action == 'delete':
        # Safely check if the freezer has food in it before allowing deletion
        entries = db.execute('SELECT id FROM entries WHERE freezer_id = ? AND auth_id = ?', (id, g.user['id'])).fetchone()
        if entries:
            flash('Cannot delete freezer because it currently contains items. Please empty or move them first.', 'error')
        else:
            db.execute('DELETE FROM freezers WHERE id = ? AND auth_id = ?', (id, g.user['id']))
            db.commit()
            flash('Freezer deleted successfully.', 'success')
            
    else: # Action is 'save'
        name = request.form.get('name')
        drawers = request.form.get('drawers', 1)
        location = request.form.get('location', '')
        
        if not name:
            flash('Freezer name is required.', 'error')
        else:
            db.execute(
                'UPDATE freezers SET name = ?, drawers = ?, location = ? WHERE id = ? AND auth_id = ?',
                (name, int(drawers), location, id, g.user['id'])
            )
            db.commit()
            flash(f'Freezer "{name}" updated successfully.', 'success')

    return redirect(url_for('categories.index'))
