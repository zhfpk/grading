import functools
import time

from flask import g, abort, request, current_app

from app.models.auth import ExamUser
from app.models.exams import Exam
from app.models.permissions import Permission


def exam_and_user_must_be_set(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        exam, user = get_exam_and_user()
        if exam is None:
            if current_app.config.get('GRADING_APP_WEB_DEBUG_MODE', False) is True:
                print("ERR: Rejected due to invalid exam")
            return abort(404)
        elif user is None:
            if current_app.config.get('GRADING_APP_WEB_DEBUG_MODE', False) is True:
                print("ERR: Rejected due to invalid examuser")
            return abort(403)
        elif user.is_active is not True:
            if current_app.config.get('GRADING_APP_WEB_DEBUG_MODE', False) is True:
                print("ERR: Rejected due to inactive examuser")
            return abort(403)

        else:
            g.exam = exam
            g.user = user
            return view(**kwargs)

    return wrapped_view


def requires_permission(permission: Permission):
    def decorator(view):
        @functools.wraps(view)
        def wrapped_view(**kwargs):
            if g.exam is None:
                return abort(404)
            if g.user is None:
                return abort(403)

            if g.user.is_active is True and g.user.has_permission(permission):
                return view(**kwargs)
            else:
                return abort(403)

        return wrapped_view
    return decorator


def only_graders_or_during_review_allowed(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.exam is None:
            return abort(404)
        if g.user is None:
            return abort(403)

        if g.user.is_active is True and (g.user.is_grader() or g.exam.is_review_allowed()):
            return view(**kwargs)
        else:
            return abort(403)

    return wrapped_view


def get_exam_and_user():
    # attempt to return g.exam and g.user if already set
    if 'exam' in g and g.exam is not None and 'user' in g and g.user is not None:
        return g.exam, g.user

    exam_name = request.args.get('exam', None)
    # first, take the uuid from the query parameters
    uuid = request.args.get('uuid', None)

    if uuid is None:
        # second, if there is none in the query parameters, attempt to load the uuid from the cookie
        uuid = request.cookies.get('uuid', None)

    exam = Exam.get(exam_name)
    if exam is None:
        return None, None

    exam_user = ExamUser.get(exam, uuid)
    if exam_user is None:
        return exam, None

    return exam, exam_user
