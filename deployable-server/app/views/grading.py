import datetime

from flask import Blueprint, abort, g, render_template, url_for, request, redirect, make_response
from markupsafe import Markup

from app.models.exams import Exam
from app.models.permissions import AccessUiPermission
from app.views.auth import exam_and_user_must_be_set, get_exam_and_user, requires_permission
from app.views.review import reviewbp
from app.views.tasks import custom_url_for

gradingbp = Blueprint('grading', __name__, url_prefix='/grading')

@gradingbp.route('/invite', methods=['GET'])
@exam_and_user_must_be_set
def invite():
    exam, user = get_exam_and_user()
    if exam is None:
        return abort(404)

    if not user.is_grader():
        return abort(403)

    return render_template("generic-app-nonav.html", page_title="Grading Invitation", vue_app_name="graderInvitationApp")


@gradingbp.route('/welcome', methods=['GET'])
@exam_and_user_must_be_set
def welcome():
    exam, user = get_exam_and_user()
    if exam is None:
        return abort(404)

    if not user.is_grader():
        return abort(403)

    resp = make_response(render_template("generic-app-nonav.html", page_title="Welcome", vue_app_name="graderWelcomeApp", disable_heading=True))

    cookie_expires = datetime.datetime.now() + datetime.timedelta(days=100)

    resp.set_cookie("uuid", user.uuid, expires=cookie_expires, httponly=False, secure=True)
    return resp


@gradingbp.route('/overview', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create("exam-overview"))
def overview():
    # exam, user = get_exam_and_user()
    return render_template("generic-app.html", page_title="Overview", vue_app_name="overviewApp")


@gradingbp.route('/individual', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create('individual-grading'))
def individual_exam_grading():
    exam, user = get_exam_and_user()

    # task_templates = []
    # for template_file in exam.get_task_templates():
    #     task_name = template_file.stem.replace(' ', '-')
    #     task_templates.append((task_name, str(template_file), session.get('show_task_' + task_name, True)))

    examinee_identifier = request.args.get('examinee', None)
    # no checking whether the examinee exists
    if examinee_identifier is None:
        return redirect(url_for("grading.overview", exam_name=g.exam.exam_name))

    examinee = exam.get_examinee(examinee_identifier)

    if examinee is None:
        return abort(404)

    task_templates = [g.exam.exam_name + "/" + template_file_name for template_file_name in g.exam.get_task_templates()] # list(map(str, g.exam.get_task_templates()))
    view = render_template('grading-individual.html',
                           page_mode_value="GRADING",
                           exam_name=g.exam.exam_name,
                           task_templates=task_templates,
                           url_for=custom_url_for,
                           anonymized_name=examinee.get_anonymized_name())

    return view


@gradingbp.route('/field', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(AccessUiPermission.create('group-grading'))
def subtask_field_grading():
    # exam, user = get_exam_and_user()

    return render_template("generic-app.html", page_title="Group grading", vue_app_name="groupGradingApp")


@gradingbp.context_processor
@reviewbp.context_processor
def utility_processor():
    def load_code(resource_filename, language=None, show_line_numbers=False):
        exam, exam_user = get_exam_and_user()
        if exam is None:
            raise Exception("No exam found")

        resource_path = exam.get_relative_resources_path(resource_filename)
        if resource_path is None:
            raise Exception(f"Resource {resource_filename} was not found")

        with open(resource_path, 'r') as f:
            lines = [line.rstrip() for line in f.readlines()]
        code = "\n".join(lines)
        if language is None:
            language = "plaintext"
        line_numbers = None
        if show_line_numbers:
            line_numbers = "\n".join([str(x+1) for x in range(0, len(lines))])

        return Markup(render_template('snippets/code.html', code=code, line_numbers=line_numbers, language=language))

    return dict(load_code=load_code)