from pathlib import Path
from flask import Blueprint, redirect, url_for, current_app, render_template

from app.views.auth import exam_and_user_must_be_set

bp = Blueprint('base', __name__, url_prefix='/')


@bp.route('/')
def start():
    return render_template('index.html')


@bp.route('/privacy')
def privacy():
    return render_template('privacy.html')


@bp.route('/documentation')
@exam_and_user_must_be_set
def documentation():
    return render_template('documentation.html')

@bp.route('/credentials')
def credentials():
    return render_template("generic-app-nonav.html", page_title="Manage Credentials", vue_app_name="manageCredentialsApp")