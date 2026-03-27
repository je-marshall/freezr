import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from werkzeug.security import check_password_hash, generate_password_hash
from freezr.db import get_db
from freezr.helpers import seed_default_categories

bp = Blueprint('auth', __name__, url_prefix='/auth')

# --- Inject users to templates globally so you don't have to edit other Python files! ---
@bp.app_context_processor
def inject_all_users():
    if g.get('user') and g.user['username'] == 'admin':
        users = get_db().execute('SELECT id, username FROM user').fetchall()
        return dict(all_users=users)
    return dict(all_users=[])

@bp.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None
        user = db.execute(
            'SELECT * FROM user WHERE username = ?', (username,)
        ).fetchone()

        if user is None:
            error = 'Incorrect username.'
        elif not check_password_hash(user['password'], password):
            error = 'Incorrect password.'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            return redirect(url_for('index.index'))  # Assuming endpoint is index.index

        flash(error)

    return render_template('auth/login.html')

@bp.before_app_request
def load_logged_in_user():
    user_id = session.get('user_id')

    if user_id is None:
        g.user = None
    else:
        g.user = get_db().execute(
            'SELECT * FROM user WHERE id = ?', (user_id,)
        ).fetchone()

@bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))

def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(url_for('auth.login'))
        return view(**kwargs)
    return wrapped_view

# ==========================================
# ADMIN ROUTES (User Management)
# ==========================================

@bp.route('/admin/add_user', methods=('POST',))
@login_required
def admin_add_user():
    if g.user['username'] != 'admin':
        flash('Access denied. Admin only.')
        return redirect(request.referrer or url_for('index.index'))
        
    username = request.form['username']
    password = request.form['password']
    db = get_db()
    error = None

    if not username or not password:
        error = 'Username and Password are required.'

    if error is None:
        try:
            # Create user
            cursor = db.execute(
                "INSERT INTO user (username, password) VALUES (?, ?)",
                (username, generate_password_hash(password)),
            )
            new_user_id = cursor.lastrowid
            
            # Seed default Kitchen Freezer and Categories
            db.execute(
                "INSERT INTO freezers (name, drawers, location, auth_id) VALUES (?, ?, ?, ?)",
                ('Kitchen Freezer', 4, 'Kitchen', new_user_id)
            )
            seed_default_categories(new_user_id)
            db.commit()
            
            flash(f"User '{username}' created successfully!")
        except db.IntegrityError:
            flash(f"User '{username}' already exists.")
    else:
        flash(error)

    return redirect(request.referrer)

@bp.route('/admin/delete_user/<int:id>', methods=('POST',))
@login_required
def admin_delete_user(id):
    if g.user['username'] != 'admin':
        flash('Access denied. Admin only.')
        return redirect(request.referrer or url_for('index.index'))
        
    if id == 1:
        flash('Cannot delete the primary admin account.')
        return redirect(request.referrer)

    db = get_db()
    # Note: SQLite should cascade delete their freezers/items if foreign keys are set up, 
    # but we delete the user safely here regardless.
    db.execute('DELETE FROM user WHERE id = ?', (id,))
    db.commit()
    flash('User account completely removed.')
    return redirect(request.referrer)
