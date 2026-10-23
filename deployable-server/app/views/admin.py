from flask import Blueprint, render_template

from app.models.permissions import AccessUiPermission
from app.views.auth import requires_permission, exam_and_user_must_be_set

bp = Blueprint('admin', __name__, url_prefix='/admin')


@bp.route('/graders', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("graders"))
def graders():
    # exam, user = get_exam_and_user()
    return render_template("generic-app.html", page_title="Manage graders", vue_app_name="manageGradersApp")


@bp.route('/points-and-grades', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("points-and-grades"))
def points_and_grades():
    # exam, user = get_exam_and_user()
    return render_template("generic-app.html", page_title="Points and grades", vue_app_name="pointsAndGradesApp")


@bp.route('/lifecycle', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("lifecycle"))
def lifecycle():
    # exam, user = get_exam_and_user()
    return render_template("generic-app.html", page_title="Exam lifecycle", vue_app_name="lifecycleApp")


@bp.route('/review', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("manage-post-exam-review"))
def review():
    # exam, user = get_exam_and_user()
    return render_template("generic-app.html", page_title="Post-exam review", vue_app_name="manageReviewApp")
