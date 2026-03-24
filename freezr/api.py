import functools
import json
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from freezr.db import get_db
from freezr.auth import login_required

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/cat', methods=('GET', 'POST', 'DELETE'))
@login_required
def category():
    db = get_db()
    if request.method == 'GET':
        categories = db.execute('SELECT category FROM categories').fetchall()
        return json.dumps({'success' : True, \
                        'categories' : categories})
    if request.method == 'POST':
        body = request.get_json()
        category = body.get('category', None)
        cat_id = body.get('cat_id', None)
        if not cat_id:
            cat_id = 'NULL'
        try:
            db.execute(
                'INSERT INTO categories (category, id) VALUES (?, ?)',
                (category, cat_id),
            )
            db.commit()
            return json.dumps({'success' : True})
        except db.IntegrityError:
            error = f'Category already registered'
            return json.dumps({'success' : False})
        flash(error)
    if request.method == 'DELETE':
        body = request.get_json()
        category = body.get('category', None)
        try:
            db.execute(
                'DELETE FROM categories WHERE category=?',
                ([category]),
            )
            db.commit()
            return json.dumps({'success' : True})
        except db.IntegrityError:
            error = f'Category not present'
            return json.dumps({'success' : False})
        flash(error)
