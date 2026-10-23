from flask import Blueprint, send_from_directory, abort, request, g, url_for

from app.views.auth import exam_and_user_must_be_set, get_exam_and_user

bp = Blueprint('tasks', __name__, url_prefix='/tasks')


@bp.route('/resource/<path:filename>', methods=['GET'])
@exam_and_user_must_be_set
def resource(filename=None):
    exam, exam_user = get_exam_and_user()
    # note: any exam user is allowed to access the resources/ files of an exam

    exam_resources_directory = exam.get_resources_directory()
    if not exam_resources_directory.is_dir():
        return abort(404)

    return send_from_directory(exam_resources_directory, filename)


def custom_url_for(endpoint, *args, **kwargs):
    if endpoint == 'tasks.resource':
        if "exam" not in kwargs:
            # inject the exam name here if the task template uses the 'tasks.resource' endpoint ...
            kwargs['exam'] = g.exam.exam_name
        if "uuid" not in kwargs and request.args.get('uuid', None) is not None:
            # inject the uuid here
            kwargs['uuid'] = request.args.get('uuid')

    return url_for(endpoint, *args, **kwargs)