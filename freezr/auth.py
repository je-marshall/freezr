import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from werkzeug.security import check_password_hash, generate_password_hash
from freezr.db import get_db

bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        password = request.form['password']
        db = get_db()
        user = db.execute('SELECT * FROM user WHERE id = 1').fetchone()

        if user is None or not check_password_hash(user['password'], password):
            flash('Incorrect password.')
        else:
            session.clear()
            session.permanent = True
            session['user_id'] = user['id']
            return redirect(url_for('index.index'))

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

@bp.route('/change_password', methods=('POST',))
@login_required
def change_password():
    current = request.form.get('current_password', '')
    new_password = request.form.get('new_password', '')
    db = get_db()
    user = db.execute('SELECT * FROM user WHERE id = 1').fetchone()

    if not check_password_hash(user['password'], current):
        flash('Current password is incorrect.')
    elif not new_password:
        flash('New password cannot be empty.')
    else:
        db.execute('UPDATE user SET password = ? WHERE id = 1',
                   (generate_password_hash(new_password),))
        db.commit()
        flash('Password updated.')

    return redirect(request.referrer or url_for('index.index'))
