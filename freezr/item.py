from flask import Blueprint, render_template
from freezr.auth import login_required
from freezr.helpers import get_entry, generate_description

bp = Blueprint('item', __name__)

@bp.route('/item/<int:id>')
@login_required
def item(id):
    entry = get_entry(id)
    generate_description([entry])
    return render_template('item.html', entry=entry)
