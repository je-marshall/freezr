from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('categories', __name__, url_prefix='/manage')

@bp.route('/')
@login_required
def index():
    db = get_db()
    user_id = g.user['id']
    
    # Fetch the user's freezers
    freezers = db.execute('SELECT * FROM freezers WHERE auth_id = ?', (user_id,)).fetchall()
    
    # Fetch all category levels
    categories_raw = db.execute('SELECT * FROM categories WHERE auth_id = ?', (user_id,)).fetchall()
    subcats_raw = db.execute('SELECT * FROM subcats WHERE auth_id = ?', (user_id,)).fetchall()
    subsubs_raw = db.execute('SELECT * FROM subsub WHERE auth_id = ?', (user_id,)).fetchall()
    
    # Build a nested tree structure for the HTML template
    category_tree = []
    for cat in categories_raw:
        cat_node = dict(cat)
        cat_node['subcats'] = []
        
        for sub in subcats_raw:
            if sub['category_id'] == cat['id']:
                sub_node = dict(sub)
                # Find all sub-subs belonging to this sub-category
                sub_node['subsubs'] = [dict(ss) for ss in subsubs_raw if ss['subcat_id'] == sub['id']]
                cat_node['subcats'].append(sub_node)
                
        category_tree.append(cat_node)

    # Grab printer settings (id is always 1)
    settings = db.execute('SELECT * FROM settings WHERE id = 1').fetchone()

    return render_template('manage.html', freezers=freezers, categories=category_tree, settings=settings)

# ==========================================
# MAIN CATEGORY ROUTES
# ==========================================

@bp.route('/add', methods=('POST',))
@login_required
def add():
    category_name = request.form.get('category_name')
    if category_name:
        db = get_db()
        db.execute('INSERT INTO categories (category, auth_id) VALUES (?, ?)', (category_name, g.user['id']))
        db.commit()
        flash(f'Category "{category_name}" added successfully!', 'success')
    else:
        flash('Category name is required.', 'error')
    return redirect(url_for('categories.index'))

@bp.route('/edit/<int:id>', methods=('POST',))
@login_required
def edit(id):
    action = request.form.get('action')
    db = get_db()
    
    if action == 'delete':
        entries = db.execute('SELECT id FROM entries WHERE category_id = ? AND auth_id = ?', (id, g.user['id'])).fetchone()
        if entries:
            flash('Cannot delete category because you have items in your freezer using it.', 'error')
        else:
            # Cascade delete sub-levels
            subcats = db.execute('SELECT id FROM subcats WHERE category_id = ?', (id,)).fetchall()
            for subcat in subcats:
                db.execute('DELETE FROM subsub WHERE subcat_id = ? AND auth_id = ?', (subcat['id'], g.user['id']))
            db.execute('DELETE FROM subcats WHERE category_id = ? AND auth_id = ?', (id, g.user['id']))
            db.execute('DELETE FROM categories WHERE id = ? AND auth_id = ?', (id, g.user['id']))
            db.commit()
            flash('Category deleted.', 'success')
    else:
        category_name = request.form.get('category_name')
        if category_name:
            db.execute('UPDATE categories SET category = ? WHERE id = ? AND auth_id = ?', (category_name, id, g.user['id']))
            db.commit()
            flash('Category updated.', 'success')
            
    return redirect(url_for('categories.index'))

# ==========================================
# SUB-CATEGORY ROUTES
# ==========================================

@bp.route('/add_subcat/<int:cat_id>', methods=('POST',))
@login_required
def add_subcat(cat_id):
    subcat_name = request.form.get('subcat_name')
    if subcat_name:
        db = get_db()
        db.execute('INSERT INTO subcats (subcat, category_id, auth_id) VALUES (?, ?, ?)', (subcat_name, cat_id, g.user['id']))
        db.commit()
        flash(f'Sub-category "{subcat_name}" added!', 'success')
    return redirect(url_for('categories.index'))

@bp.route('/edit_subcat/<int:id>', methods=('POST',))
@login_required
def edit_subcat(id):
    action = request.form.get('action')
    db = get_db()
    
    if action == 'delete':
        entries = db.execute('SELECT id FROM entries WHERE subcat_id = ? AND auth_id = ?', (id, g.user['id'])).fetchone()
        if entries:
            flash('Cannot delete sub-category because items are currently using it.', 'error')
        else:
            db.execute('DELETE FROM subsub WHERE subcat_id = ? AND auth_id = ?', (id, g.user['id']))
            db.execute('DELETE FROM subcats WHERE id = ? AND auth_id = ?', (id, g.user['id']))
            db.commit()
            flash('Sub-category deleted.', 'success')
    else:
        subcat_name = request.form.get('subcat_name')
        if subcat_name:
            db.execute('UPDATE subcats SET subcat = ? WHERE id = ? AND auth_id = ?', (subcat_name, id, g.user['id']))
            db.commit()
            flash('Sub-category updated.', 'success')
    return redirect(url_for('categories.index'))

# ==========================================
# SUB-SUB-CATEGORY ROUTES
# ==========================================

@bp.route('/add_subsub/<int:subcat_id>', methods=('POST',))
@login_required
def add_subsub(subcat_id):
    subsub_name = request.form.get('subsub_name')
    if subsub_name:
        db = get_db()
        db.execute('INSERT INTO subsub (subsub, subcat_id, auth_id) VALUES (?, ?, ?)', (subsub_name, subcat_id, g.user['id']))
        db.commit()
        flash(f'Type "{subsub_name}" added!', 'success')
    return redirect(url_for('categories.index'))

@bp.route('/edit_subsub/<int:id>', methods=('POST',))
@login_required
def edit_subsub(id):
    action = request.form.get('action')
    db = get_db()
    
    if action == 'delete':
        entries = db.execute('SELECT id FROM entries WHERE subsub = ? AND auth_id = ?', (id, g.user['id'])).fetchone()
        if entries:
            flash('Cannot delete type because items are currently using it.', 'error')
        else:
            db.execute('DELETE FROM subsub WHERE id = ? AND auth_id = ?', (id, g.user['id']))
            db.commit()
            flash('Type removed.', 'success')
    else:
        subsub_name = request.form.get('subsub_name')
        if subsub_name:
            db.execute('UPDATE subsub SET subsub = ? WHERE id = ? AND auth_id = ?', (subsub_name, id, g.user['id']))
            db.commit()
            flash('Type updated.', 'success')
    return redirect(url_for('categories.index'))
