from flask import Blueprint, g, request, jsonify
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('checkin', __name__, url_prefix='/checkin')

@bp.route('/new', methods=('POST',))
@login_required
def checkin():
    category   = request.form.get('category')
    subcat     = request.form.get('subcat')
    subsub     = request.form.get('subsub') or None
    freezer    = request.form.get('freezer')
    drawer     = request.form.get('drawer')
    quantity   = request.form.get('quantity', 1)
    notes      = request.form.get('notes', '')
    date_added = request.form.get('date_added') or None

    skin   = 1 if request.form.get('skin')   else 0
    bone   = 1 if request.form.get('bone')   else 0
    minced = 1 if request.form.get('minced') else 0
    grated = 1 if request.form.get('grated') else 0
    cooked = 1 if request.form.get('cooked') else 0

    error = None
    if not category:
        error = 'Category is required.'
    elif not subcat:
        error = 'Sub category is required.'
    elif not freezer:
        error = 'Freezer selection is required.'
    elif not drawer:
        error = 'Drawer number is required.'

    if error is None:
        try:
            db = get_db()
            # Verify submitted IDs belong to the current user
            if not db.execute('SELECT 1 FROM categories WHERE id = ? AND auth_id = ?', (category, g.user['id'])).fetchone():
                return jsonify({'success': False, 'message': 'Invalid category.'}), 400
            if not db.execute('SELECT 1 FROM subcats WHERE id = ? AND auth_id = ?', (subcat, g.user['id'])).fetchone():
                return jsonify({'success': False, 'message': 'Invalid sub-category.'}), 400
            if not db.execute('SELECT 1 FROM freezers WHERE id = ? AND auth_id = ?', (freezer, g.user['id'])).fetchone():
                return jsonify({'success': False, 'message': 'Invalid freezer.'}), 400
            if date_added:
                cursor = db.execute(
                    '''INSERT INTO entries
                    (category_id, subcat_id, subsub, freezer_id, drawer, skin, bone, minced, grated, cooked, notes, quantity, auth_id, created)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (category, subcat, subsub, freezer, drawer, skin, bone, minced, grated, cooked, notes, quantity, g.user['id'], date_added),
                )
            else:
                cursor = db.execute(
                    '''INSERT INTO entries
                    (category_id, subcat_id, subsub, freezer_id, drawer, skin, bone, minced, grated, cooked, notes, quantity, auth_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (category, subcat, subsub, freezer, drawer, skin, bone, minced, grated, cooked, notes, quantity, g.user['id']),
                )
            db.commit()
            return jsonify({'success': True, 'entry_id': cursor.lastrowid})

        except Exception as e:
            error = f'An error occurred while saving the entry: {e}'

    return jsonify({'success': False, 'message': error}), 400
