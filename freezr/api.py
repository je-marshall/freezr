import json
import logging
import datetime
from flask import (
    Blueprint, flash, g, request, jsonify, redirect, url_for, current_app
)
from freezr.db import get_db
from freezr.auth import login_required
from freezr.printer import print_label

log = logging.getLogger(__name__)
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

@bp.route('/subcat', methods=('POST',))
@login_required
def add_subcat_json():
    """Inline-add a sub-category during check-in, returning JSON so the wizard
    never has to leave the modal."""
    body = request.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    cat_id = body.get('category_id')
    qty_type = body.get('quantity_type') or 'count'
    if qty_type not in ('count', 'weight', 'volume'):
        qty_type = 'count'
    if not name or not cat_id:
        return jsonify({'success': False, 'message': 'Name and category are required.'}), 400

    db = get_db()
    if not db.execute('SELECT 1 FROM categories WHERE id = ? AND auth_id = ?', (cat_id, g.user['id'])).fetchone():
        return jsonify({'success': False, 'message': 'Invalid category.'}), 400
    cur = db.execute(
        'INSERT INTO subcats (subcat, quantity_type, category_id, auth_id) VALUES (?, ?, ?, ?)',
        (name, qty_type, cat_id, g.user['id'])
    )
    db.commit()
    return jsonify({'success': True, 'id': cur.lastrowid, 'subcat': name,
                    'category_id': cat_id, 'quantity_type': qty_type})


@bp.route('/subsub', methods=('POST',))
@login_required
def add_subsub_json():
    """Inline-add a type (sub-sub-category) during check-in, returning JSON."""
    body = request.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    subcat_id = body.get('subcat_id')
    if not name or not subcat_id:
        return jsonify({'success': False, 'message': 'Name and sub-category are required.'}), 400

    db = get_db()
    if not db.execute('SELECT 1 FROM subcats WHERE id = ? AND auth_id = ?', (subcat_id, g.user['id'])).fetchone():
        return jsonify({'success': False, 'message': 'Invalid sub-category.'}), 400
    cur = db.execute(
        'INSERT INTO subsub (subsub, subcat_id, auth_id) VALUES (?, ?, ?)',
        (name, subcat_id, g.user['id'])
    )
    db.commit()
    return jsonify({'success': True, 'id': cur.lastrowid, 'subsub': name, 'subcat_id': subcat_id})


@bp.route('/print/<int:id>', methods=('POST',))
@login_required
def print_item(id):
    """ Receives print command from the javascript client and triggers the Brother backend """
    log.info('Print request received for entry id=%s', id)
    db = get_db()

    settings = db.execute('SELECT * FROM settings WHERE id = 1').fetchone()
    if not settings or not settings['printer_identifier']:
        log.warning('Print request for id=%s failed: no printer configured in settings', id)
        return jsonify({'success': False, 'message': 'Printer is not configured in settings.'})

    log.debug('Printer settings: model=%s label=%s identifier=%r',
              settings['printer_model'], settings['label_size'], settings['printer_identifier'])

    body = request.get_json()
    desc = body.get('desc', 'Unknown Item') if body else 'Unknown Item'
    log.debug('Label description: %r', desc)

    date_str = datetime.datetime.now().strftime('%d/%m/%Y')

    try:
        success, msg = print_label(
            entry_id=id,
            description=desc,
            date_str=date_str,
            printer_identifier=settings['printer_identifier'],
            printer_model=settings['printer_model'],
            label_size=settings['label_size'],
            base_url=settings.get('base_url'),
        )
        if success:
            log.info('Print succeeded for entry id=%s', id)
        else:
            log.warning('Print failed for entry id=%s: %s', id, msg)
        return jsonify({'success': success, 'message': msg})
    except Exception:
        log.exception('Unhandled exception in print_item for entry id=%s', id)
        return jsonify({'success': False, 'message': 'An unexpected error occurred — check the logs.'})

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
        printer_model = request.form.get('printer_model', 'QL-700')
        label_size = request.form.get('label_size', '62')
        base_url = request.form.get('base_url', '').strip() or None
        log.info('Saving printer settings: model=%s label=%s identifier=%r base_url=%r',
                 printer_model, label_size, printer_identifier, base_url)

        existing = db.execute('SELECT id FROM settings WHERE id = 1').fetchone()
        if existing:
            db.execute('UPDATE settings SET printer_identifier = ?, printer_model = ?, label_size = ?, base_url = ? WHERE id = 1',
                (printer_identifier, printer_model, label_size, base_url))
        else:
            db.execute('INSERT INTO settings (id, printer_identifier, printer_model, label_size, base_url) VALUES (1, ?, ?, ?, ?)',
                (printer_identifier, printer_model, label_size, base_url))
        db.commit()
        log.info('Printer settings saved')
        flash('Printer settings saved successfully.', 'success')
        return redirect(request.referrer or url_for('categories.index'))
