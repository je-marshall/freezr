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
    
    # Fetch the user's specific freezers and categories
    freezers = db.execute('SELECT * FROM freezers WHERE auth_id = ?', (user_id,)).fetchall()
    categories = db.execute('SELECT * FROM categories WHERE auth_id = ?', (user_id,)).fetchall()
    
    return render_template('manage.html', freezers=freezers, categories=categories)

@bp.route('/add', methods=('POST',))
@login_required
def add():
    category_name = request.form.get('category_name')
    
    if not category_name:
        flash('Category name is required.', 'error')
    else:
        db = get_db()
        db.execute(
            'INSERT INTO categories (category, auth_id) VALUES (?, ?)',
            (category_name, g.user['id'])
        )
        db.commit()
        flash(f'Category "{category_name}" added successfully!', 'success')
        
    return redirect(url_for('categories.index'))

@bp.route('/edit/<int:id>', methods=('POST',))
@login_required
def edit(id):
    action = request.form.get('action')
    db = get_db()
    
    if action == 'delete':
        # Safely check if any food items are currently using this category
        entries = db.execute('SELECT id FROM entries WHERE category_id = ? AND auth_id = ?', (id, g.user['id'])).fetchone()
        if entries:
            flash('Cannot delete category because you have items in your freezer using it.', 'error')
        else:
            # Cascade delete: clean up sub-categories and sub-subs first
            subcats = db.execute('SELECT id FROM subcats WHERE category_id = ?', (id,)).fetchall()
            for subcat in subcats:
                db.execute('DELETE FROM subsub WHERE subcat_id = ? AND auth_id = ?', (subcat['id'], g.user['id']))
                
            db.execute('DELETE FROM subcats WHERE category_id = ? AND auth_id = ?', (id, g.user['id']))
            db.execute('DELETE FROM categories WHERE id = ? AND auth_id = ?', (id, g.user['id']))
            db.commit()
            flash('Category completely removed.', 'success')
            
    else: # Action is 'save'
        category_name = request.form.get('category_name')
        if not category_name:
            flash('Category name is required.', 'error')
        else:
            db.execute(
                'UPDATE categories SET category = ? WHERE id = ? AND auth_id = ?',
                (category_name, id, g.user['id'])
            )
            db.commit()
            flash(f'Category updated to "{category_name}".', 'success')

    return redirect(url_for('categories.index'))
