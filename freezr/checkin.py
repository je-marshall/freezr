import functools
from flask import (
    Blueprint, flash, g, redirect, request, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('checkin', __name__, url_prefix='/checkin')

# Changed methods to only accept POST since the form is a modal on the index page
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
    
    # Checkboxes: if they are present in the form data, they were checked (1), otherwise (0)
    skin = 1 if request.form.get('skin') else 0
    bone = 1 if request.form.get('bone') else 0
    minced = 1 if request.form.get('minced') else 0
    grated = 1 if request.form.get('grated') else 0
    cooked = 1 if request.form.get('cooked') else 0
    
    # NEW: Catch the optional print label checkbox
    print_label = 1 if request.form.get('print_label') else 0

    db = get_db()
    error = None

    # Basic validation to ensure dropdowns weren't bypassed
    if not category:
        error = 'Category is required.'
    elif not subcat:
        error = 'Sub category is required.'
    elif not freezer:
        error = 'Freezer selection is required.'
    elif not drawer:
        error = 'Drawer number is required.'

    # Convert an empty subsub string to None so the database inserts a clean NULL
    if not subsub:
        subsub = None

    if error is None:
        try:
            # We assign the execute result to 'cursor' so we can get the ID of the new item!
            cursor = db.execute(
                '''INSERT INTO entries 
                (category_id, subcat_id, subsub, freezer_id, drawer, skin, bone, minced, grated, cooked, notes, quantity, auth_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (category, subcat, subsub, freezer, drawer, skin, bone, minced, grated, cooked, notes, quantity, g.user['id']),
            )
            db.commit()
            
            # Grab the ID of the item we just created
            new_id = cursor.lastrowid
            
            # If the user kept the Print Label checkbox checked, trigger the hidden print script
            if print_label:
                flash(f'PRINT_ID:{new_id}')
                
            flash('ITEM CHECKED IN')
        except db.IntegrityError as e:
            error = f'An error occurred while saving the entry: {e}'
            flash(error)
    else:
        flash(error)
            
    # Always redirect back to the main inventory list
    return redirect(url_for('index.index'))
