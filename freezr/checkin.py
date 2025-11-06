import functools
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from freezr.db import get_db

bp = Blueprint('checkin', __name__, url_prefix='/checkin')

@bp.route('/new', methods=('GET', 'POST'))
def checkin():
    if request.method == 'POST':
        category = request.form['category']
        subcat = request.form['subcat']
        subsub = request.form['subsub']
        db = get_db()
        error = None
        if not category:
            error = 'Category is required.'
        elif not subcat:
            error = 'Sub category is required.'
        elif not subsub:
            error = 'Sub sub category is required.'
        if error is None:
            try:
                db.execute(
                    'INSERT INTO entries(category, subcat, subsub) VALUES (?, ?, ?)',
                    (category, subcat, subsub),
                )
                db.commit()
            except db.IntegrityError:
                error = 'Entry already registered.'
        flash(error)
    return render_template('checkin/new.html')
