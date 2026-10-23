from flask import Blueprint, render_template, abort, request, redirect, g

from app.models.permissions import AccessUiPermission, PostExamReviewPermission
from app.views.auth import exam_and_user_must_be_set, requires_permission, get_exam_and_user
from app.views.tasks import custom_url_for

reviewbp = Blueprint('review', __name__, url_prefix='/review')


# @bp.route('/')
# def index():
#     return render_template('index.html')


@reviewbp.route('/invite')
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("post-exam-review-invitation"))
def invite():
    exam, user = get_exam_and_user()

    examinee_identifier = request.args.get('examinee', None)
    if examinee_identifier is None:
        return abort(404)

    examinee = exam.get_examinee(examinee_identifier)

    if examinee is None:
        return abort(404)

    if not user.has_permission(PostExamReviewPermission.create(examinee.get_identifier())):
        # note: the 404 here is important to "hide" that the examinee identifier is a valid identifier
        return abort(404)

    if not exam.is_review_allowed():
        return render_template('post-exam-review-unavailable.html', page_title='Review Unavailable')
    else:
        return render_template("generic-app-nonav.html", page_title="Review Invitation", vue_app_name="postExamReviewInvitationApp")


@reviewbp.route("/perform-review")
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("post-exam-review-perform"))
def perform_review():
    exam, user = get_exam_and_user()

    examinee_identifier = request.args.get('examinee', None)
    if examinee_identifier is None:
        return abort(404)

    examinee = exam.get_examinee(examinee_identifier)

    if examinee is None:
        return abort(404)

    if not user.has_permission(PostExamReviewPermission.create(examinee.get_identifier())):
        # note: the 404 here is important to "hide" that the examinee identifier is a valid identifier
        return abort(404)

    # graders can review at any time
    if not user.is_grader() and not exam.is_review_allowed():
        return render_template('post-exam-review-unavailable.html', page_title='Review Unavailable')

    # make sure to track that the examinee visited this page (but a grader cannot be falsely registered as a "reviewing" user)
    if not user.is_grader():
        examinee.set_post_exam_review_accessed(True)

    task_templates = [g.exam.exam_name + "/" + template_file_name for template_file_name in
                      g.exam.get_task_templates()]
    view = render_template('grading-individual.html',
                           page_mode_value="REVIEW",
                           exam_name=g.exam.exam_name,
                           task_templates=task_templates,
                           url_for=custom_url_for,
                           anonymized_name=examinee.get_anonymized_name())

    return view