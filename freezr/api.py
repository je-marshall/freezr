import json
import datetime
from flask import (
    Blueprint, flash, request, jsonify, redirect, url_for
)
from freezr.db import get_db
from freezr.auth import login_required
from freezr.printer import print_label

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/cat', methods=('GET', 'POST', 'DELETE'))
@login_required
def category():
    db = get_db()
    if request.method == 'GET':
        categories = db.execute('SELECT category FROM categories').fetchall()
        return json.dumps({'success' : True, 'categories' : [dict(row) for row in categories]})
    if request.method == 'POST':
        body = request.get_json()
        category = body.get('category', None)
        cat_id = body.get('cat_id', None)
        if not cat_id:
            cat_id = 'NULL'
        try:
            db.execute('INSERT INTO categories (category, id) VALUES (?, ?)', (category, cat_id))
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
            db.execute('DELETE FROM categories WHERE category=?', ([category]))
            db.commit()
            return json.dumps({'success' : True})
        except db.IntegrityError:
            error = f'Category not present'
            return json.dumps({'success' : False})

@bp.route('/print/<int:id>', methods=('POST',))
@login_required
def print_item(id):
    """ Receives print command from the javascript client and triggers the Brother backend """
    db = get_db()
    
    settings = db.execute('SELECT * FROM settings WHERE id = 1').fetchone()
    if not settings or not settings['printer_identifier']:
        return jsonify({'success': False, 'message': 'Printer is not configured in settings.'})

    body = request.get_json()
    desc = body.get('desc', 'Unknown Item') if body else 'Unknown Item'
    
    # We use today's date for the label stamp
    date_str = datetime.datetime.now().strftime('%d/%m/%Y')
    
    try:
        success, msg = print_label(
            entry_id=id, 
            description=desc, 
            date_str=date_str, 
            printer_identifier=settings['printer_identifier'], 
            printer_model=settings['printer_model'], 
            label_size=settings['label_size']
        )
        return jsonify({'success': success, 'message': msg})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@bp.route('/settings', methods=('GET', 'POST'))
@login_required
def settings():
    """ Handles fetching and saving printer settings for the UI """
    db = get_db()
    if request.method == 'GET':
        row = db.execute('SELECT * FROM settings WHERE id = 1').fetchone()
        if row:
            return jsonify({'success': True, 'settings': dict(row)})
        return jsonify({'success': True, 'settings': {}})
        
    if request.method == 'POST':
        printer_identifier = request.form.get('printer_identifier')
        printer_model = request.form.get('printer_model', 'QL-600')
        label_size = request.form.get('label_size', '62x29')

        existing = db.execute('SELECT id FROM settings WHERE id = 1').fetchone()
        if existing:
            db.execute('UPDATE settings SET printer_identifier = ?, printer_model = ?, label_size = ? WHERE id = 1',
                (printer_identifier, printer_model, label_size))
        else:
            db.execute('INSERT INTO settings (id, printer_identifier, printer_model, label_size) VALUES (1, ?, ?, ?)',
                (printer_identifier, printer_model, label_size))
        db.commit()
        flash('Printer settings saved successfully.', 'success')
        return redirect(request.referrer or url_for('categories.index'))
