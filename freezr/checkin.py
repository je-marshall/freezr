import functools
from flask import (
    Blueprint, flash, g, redirect, request, url_for, jsonify
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('checkin', __name__, url_prefix='/checkin')

@bp.route('/new', methods=('POST',))
@login_required
def checkin():
    # Grab all standard form fields
    category = request.form.get('category')
    subcat = request.form.get('subcat')
    subsub = request.form.get('subsub')
    freezer = request.form.get('freezer')
    drawer = request.form.get('drawer')
    quantity = request.form.get('quantity', 1)
    notes = request.form.get('notes', '')
    
    # Checkboxes
    skin = 1 if request.form.get('skin') else 0
    bone = 1 if request.form.get('bone') else 0
    minced = 1 if request.form.get('minced') else 0
    grated = 1 if request.form.get('grated') else 0
    cooked = 1 if request.form.get('cooked') else 0

    db = get_db()
    error = None

    # Basic validation
    if not category:
        error = 'Category is required.'
    elif not subcat:
        error = 'Sub category is required.'
    elif not freezer:
        error = 'Freezer selection is required.'
    elif not drawer:
        error = 'Drawer number is required.'

    # Convert an empty subsub string to None for clean NULL inserts
    if not subsub:
        subsub = None

    if error is None:
        try:
            cursor = db.execute(
                '''INSERT INTO entries 
                (category_id, subcat_id, subsub, freezer_id, drawer, skin, bone, minced, grated, cooked, notes, quantity, auth_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (category, subcat, subsub, freezer, drawer, skin, bone, minced, grated, cooked, notes, quantity, g.user['id']),
            )
            db.commit()
            new_id = cursor.lastrowid
            
            # PROPER API RESPONSE: Return JSON instead of redirecting
            return jsonify({'success': True, 'entry_id': new_id})

        except db.IntegrityError as e:
            error = f'An error occurred while saving the entry: {e}'
            
    # Return error as JSON
    return jsonify({'success': False, 'message': error}), 400
