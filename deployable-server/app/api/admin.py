import datetime

from flask import Blueprint, jsonify, request, abort

from app.models.auth import ExamUser
from app.models.permissions import DownloadExamDataPermission, ManageGradersPermission, PermissionFactory, \
    ManageLifecyclePermission, UpdateExamDataPermission
from app.models.utils import RandomNameGenerator
from app.views.auth import exam_and_user_must_be_set, requires_permission, get_exam_and_user

bp = Blueprint('api-admin', __name__, url_prefix='/api')

@bp.route('/examgraders', methods=['GET'])
@exam_and_user_must_be_set
@requires_permission(DownloadExamDataPermission.create('exam-graders'))
def get_exam_graders():
    exam, current_user = get_exam_and_user()

    # warning: be careful not to leak the UUIDs nor any encrypted content

    # note: also includes examinees during the "review" phase when not filtering with is_grader()

    graders = []
    for exam_user in ExamUser.list_users(exam):
        if not exam_user.is_grader():
            continue
        grader_data = {
            "pseudonym": exam_user.pseudonym,
            "self": exam_user.uuid == current_user.uuid,
            "state": exam_user.get_state(),
            "permissions": exam_user.stringify_permissions()
        }

        if current_user.has_permission(DownloadExamDataPermission.create('exam-graders-personal-data')):
            grader_data["encrypted_name"] = exam_user.encrypted_name_others

        graders.append(grader_data)

    return jsonify(graders)


@bp.route('/deletegrader', methods=['DELETE'])
@exam_and_user_must_be_set
@requires_permission(ManageGradersPermission.create("delete-grader"))
def delete_grader():
    exam, current_user = get_exam_and_user()

    grader_name = request.json.get("grader_name", None)

    matching_graders = [exam_user for exam_user in ExamUser.list_users(exam) if exam_user.is_grader() and exam_user.pseudonym == grader_name]

    if len(matching_graders) == 0:
        # no grader found with this name
        return abort(404)
    elif len(matching_graders) > 1:
        # more than one grader found with this name (critical server error)
        return abort(500)

    matching_grader = matching_graders[0]
    if matching_grader.uuid == current_user.uuid:
        # cannot delete yourself
        return abort(400)

    if matching_grader.has_permission(ManageGradersPermission.create("non-deletable")):
        # cannot delete an undeletable grader
        return abort(403)

    # 1) start deleting the grading of that grader, assuming there is a public key (otherwise, there cannot be any gradings)
    #    note: reassessment results are not impacted by deleting a grader as they get invalid by design (the public key of the reassessment grader is no longer valid, hence, the reassessment result becomes invalid)
    if matching_grader.has_public_signing_key():
        examinees = exam.get_examinees()
        for examinee in examinees.values():
            # go through all examinees and fetch all encrypted grading points files
            grading_points_files = examinee.get_encrypted_grading_points_files(include_signature_files=False)
            for grading_points_file in grading_points_files:
                # go through all those files and check whether the signature exists - and if so - check whether the public key of the deleted grader was used to sign the grading
                grading_point_signature_file = examinee.get_signature_file_for_grading_points(grading_points_file.name)
                if grading_point_signature_file.is_file():
                    signature_content = examinee.get_encrypted_grading_points_signature(grading_points_file.name)
                    if signature_content['public_key'] == matching_grader.public_signing_key_hex:
                        # delete both files
                        grading_point_signature_file.unlink()
                        grading_points_file.unlink()
                else:
                    # if there is a grading points file without a signature, delete it as well
                    grading_points_file.unlink()

    # 2) delete the files of that ExamUser
    matching_grader.delete_user_files()

    return "", 204


@bp.route('/addgrader', methods=['POST'])
@exam_and_user_must_be_set
@requires_permission(ManageGradersPermission.create("add-grader"))
def add_grader():
    exam, current_user = get_exam_and_user()

    uuid = request.json.get("uuid", None)
    permissions = request.json.get("permissions", None)
    encrypted_key_store = request.json.get("encrypted_key_store", None)
    encrypted_name_self = request.json.get("encrypted_name_self", None)
    encrypted_name_others = request.json.get("encrypted_name_others", None)
    master_encryption_public_key_hex = request.json.get("master_encryption_public_key_hex", None)

    if uuid is None or permissions is None or encrypted_key_store is None:
        return abort(400)

    # check if the provided uuid is valid and does not exist yet
    if type(uuid) is not str:
        return abort(400)
    if not ExamUser.is_valid_uuid_format(uuid):
        return abort(400)
    if uuid in ExamUser.list_uuids(exam):
        return abort(400)

    # reject invalid types of permissions and encrypted key store
    if type(permissions) is not list:
        return abort(400)
    if type(encrypted_key_store) is not str or len(encrypted_key_store.strip()) == 0:
        return abort(400)

    # reject too long permissions and encrypted key store
    if len(permissions) > 100000:  # max 100 000 entries
        return abort(413)
    if len(encrypted_key_store) > 8 * 1024 * 1024:  # 8mb
        return abort(413)

    # reject invalid encrypted names (self and others)
    if type(encrypted_name_self) is not str or len(encrypted_name_self.strip()) == 0:
        return abort(400)
    if len(encrypted_name_self) > 1024:
        return abort(413)
    if type(encrypted_name_others) is not str or len(encrypted_name_others.strip()) == 0:
        return abort(400)
    if len(encrypted_name_others) > 1024:
        return abort(413)

    valid_permissions = set()
    # if there is a single invalid permission, reject the request
    for user_supplied_permission in permissions:
        # check for valid permission name format
        try:
            parsed_permission = PermissionFactory.from_string(user_supplied_permission)
        except ValueError:
            return abort(400)
        # check if current user has the permission the source user wants to inherit
        if not current_user.has_permission(parsed_permission):
            return abort(403)
        # all good? add the permission to the set of permissions to remove duplicates
        valid_permissions.add(str(parsed_permission))

    # cannot have a user with empty permissions
    if len(valid_permissions) == 0:
        return abort(400)

    taken_grader_names = set(user.pseudonym for user in ExamUser.list_users(exam) if user.is_grader())
    random_pseudonym = RandomNameGenerator.generate_grader_pseudonym(taken_grader_names)

    new_exam_user = ExamUser(exam, uuid, random_pseudonym, encrypted_key_store, master_encryption_public_key_hex,
                             valid_permissions, True, encrypted_name_self=encrypted_name_self,
                             encrypted_name_others=encrypted_name_others, public_signing_key_hex=None)

    try:
        new_exam_user.save()
    except:
        return abort(500)

    return "", 201


@bp.route("/examphase", methods=["PUT"])
@exam_and_user_must_be_set
@requires_permission(ManageLifecyclePermission.create("change-phase"))
def set_exam_phase():
    exam, exam_user = get_exam_and_user()

    exam_phase = request.json.get("exam_phase", None)

    if exam_phase is None:
        return abort(400)

    if type(exam_phase) is not str:
        return abort(400)

    exam_phase = exam_phase.lower().strip()

    if exam_phase not in ['grading', 'review', 'reassessment']:
        return abort(400)

    try:
        exam.save_exam_phase(exam_phase)
    except:
        return abort(500)

    return "", 201


@bp.route("/gradecalculation", methods=["PUT"])
@exam_and_user_must_be_set
@requires_permission(UpdateExamDataPermission.create("grade-calculation"))
def save_grade_calculation():
    exam, exam_user = get_exam_and_user()

    new_grade_limits = request.json.get("grade_limits", None)

    if exam.get_exam_phase() != 'grading':
        return abort(400)

    if new_grade_limits is None:
        return abort(400)

    if type(new_grade_limits) is not dict:
        return abort(400)

    grade_calculation = exam.get_grade_calculation()
    current_grade_calculation = grade_calculation['grade-calculation']

    points_previous_better_grade = None

    # note: this for loops over a list, not a dict
    new_grade_calculation_limits = list()
    for (grade, points_limit) in current_grade_calculation['grade-limits']:
        if grade not in new_grade_limits:
            # make sure that no grade entry (e.g., "4.0" is deleted)
            return abort(400)
        new_grade_point_limit = new_grade_limits[grade]
        if type(new_grade_point_limit) is not int:
            # make sure the grade point limit is an integer
            return abort(400)
        if new_grade_point_limit < 0:
            # make sure the value is not smaller than 0
            return abort(400)
        if points_previous_better_grade is not None and new_grade_point_limit > points_previous_better_grade:
            # make sure that the new grade point limit is below the point limit of the better grade
            return abort(400)

        points_previous_better_grade = new_grade_point_limit
        new_grade_calculation_limits.append((grade, new_grade_point_limit))

    # we take the required points for 4.0 from the "new" grade limits
    new_passed_limit = new_grade_limits.get('4.0', None)
    if new_passed_limit is None:
        return abort(400)

    current_grade_calculation['passed-limit'] = new_passed_limit
    current_grade_calculation['grade-limits'] = new_grade_calculation_limits

    try:
        exam.save_grade_calculation(current_grade_calculation)
    except:
        return abort(500)

    return "", 201


@bp.route("/reviewconfig", methods=["GET"])
@exam_and_user_must_be_set
@requires_permission(DownloadExamDataPermission.create("post-exam-review-timeframe"))
def get_review_config():
    exam, _ = get_exam_and_user()

    review_config = exam.get_review_config()

    return jsonify({
        'server_time': datetime.datetime.now().ctime(),
        'timeframe_until': review_config['timeframe_until'].isoformat(),
        'timeframe_from': review_config['timeframe_from'].isoformat(),
        'review_allowed': exam.is_review_allowed()
    })


@bp.route("/reviewconfig", methods=["PUT"])
@exam_and_user_must_be_set
@requires_permission(UpdateExamDataPermission.create("post-exam-review-timeframe"))
def save_review_config():
    exam, _ = get_exam_and_user()

    timeframe_until = request.json.get("timeframe_until", None)
    timeframe_from = request.json.get("timeframe_from", None)

    if timeframe_from is None or timeframe_until is None:
        return abort(400)

    if type(timeframe_from) is not str or type(timeframe_until) is not str:
        return abort(400)

    try:
        timeframe_from = datetime.date.fromisoformat(timeframe_from)
        timeframe_until = datetime.date.fromisoformat(timeframe_until)
        exam.save_review_config(timeframe_from, timeframe_until)
    except:
        return abort(400)

    return "", 201
