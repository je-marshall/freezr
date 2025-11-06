from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from werkzeug.exceptions import abort
from freezr.auth import login_required
from freezr.db import get_db
from freezr.helpers import (get_all_entries, generate_description)

bp = Blueprint('index', __name__)

@bp.route('/')
@login_required
def index():
    all_entries = get_all_entries()
    generate_description(all_entries)
    return render_template('main.html', entries=all_entries)
