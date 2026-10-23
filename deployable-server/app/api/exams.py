import base64
import re
import time
from pathlib import Path
from flask import Blueprint, redirect, url_for, current_app, render_template, abort, jsonify, request, g

from app.models.auth import ExamUser
from app.models.permissions import DownloadExamDataPermission, DownloadExamineeDataPermission, \
    DownloadSubmissionPermission, DownloadGradingPointsPermission, UploadGradingPointsPermission, \
    UploadReassessmentResultPermission
from app.views.auth import get_exam_and_user, exam_and_user_must_be_set, requires_permission, only_graders_or_during_review_allowed

bp = Blueprint('api-exams', __name__, url_prefix='/api')


@bp.route("/tasksdata", methods=["GET"])
@exam_and_user_must_be_set
@requires_permission(DownloadExamDataPermission.create('task-data'))
@only_graders_or_during_review_allowed
def get_tasks_data():
    exam, exam_user = get_exam_and_user()
    return jsonify({
        'exam': exam.get_public_exam_meta_data(),
        'tasks': exam.get_tasks_json_data()
    })


@bp.route("/gradecalculation", methods=["GET"])
@exam_and_user_must_be_set
@requires_permission(DownloadExamDataPermission.create('grade-calculation'))
@only_graders_or_during_review_allowed
def get_grade_calculation():
    exam, exam_user = get_exam_and_user()

    return jsonify(exam.get_grade_calculation())


@bp.route("/examphase", methods=["GET"])
@exam_and_user_must_be_set
@requires_permission(DownloadExamDataPermission.create('exam-phase'))
def get_exam_phase():
    exam, exam_user = get_exam_and_user()

    return jsonify(exam.get_exam_phase())


@bp.route('/filemappings', methods=['GET'])
@exam_and_user_must_be_set
@only_graders_or_during_review_allowed
def get_file_mappings():
    exam, exam_user = get_exam_and_user()
    examinees = exam.get_examinees()

    data_to_return = dict()

    for examinee in examinees.values():
        if not exam_user.has_permission(DownloadExamineeDataPermission.create('anonymized-data', examinee.get_identifier())):
            # without this permission, an ExamUser is not allowed to learn that the given examinee exists
            continue

        returned_examinee_data = dict()

        if exam_user.has_permission(DownloadExamineeDataPermission.create('file-mapping', examinee.get_identifier())):
            # if the user can download ANY submission or ANY grading points of this examinee
            returned_examinee_data['file-mapping.enc'] = examinee.get_encrypted_file_mapping()
            returned_examinee_data['file-mapping.enc.sig'] = examinee.get_encrypted_file_mapping_signature()

        data_to_return[examinee.get_identifier()] = returned_examinee_data

    return jsonify(data_to_return)


@bp.route('/submissions', methods=['GET'])
@exam_and_user_must_be_set
@only_graders_or_during_review_allowed
def get_examinees_submissions():
    exam, exam_user = get_exam_and_user()
    examinees = exam.get_examinees()

    # if this is not None, only include the submission of this examinee
    target_examinee = request.args.get('examineeIdentifier', None)

    data_to_return = dict()

    for _, examinee in sorted(examinees.items(), key=lambda item: item[0]):

        if not exam_user.has_permission(DownloadExamineeDataPermission.create('anonymized-data', examinee.get_identifier())):
            # without this permission, an ExamUser is not allowed to learn that the given examinee exists
            continue

        returned_examinee_data = dict()
        returned_examinee_data['anonymized_first_name'] = examinee.first_name
        returned_examinee_data['anonymized_last_name'] = examinee.last_name

        requires_file_mapping_to_be_included = False

        # include the personal-data.enc file when the ExamUser has the permission
        if exam_user.has_permission(DownloadExamineeDataPermission.create('personal-data', examinee.get_identifier())):
            if target_examinee is None or target_examinee == examinee.get_identifier():
                # only include the encrypted personal data if *all* examinees or *this* examinee is queried
                returned_examinee_data['personal-data.enc'] = examinee.get_encrypted_personal_data()
                returned_examinee_data['personal-data.enc.sig'] = examinee.get_encrypted_personal_data_signature()

        # include the submissions of the examinee when the ExamUser has the permission
        for encrypted_submission_file in examinee.get_encrypted_submission_files():
            required_permission = DownloadSubmissionPermission.create(examinee.get_identifier(), encrypted_submission_file.name)
            if exam_user.has_permission(required_permission) is True:
                if target_examinee is None or target_examinee == examinee.get_identifier():
                    # only include the encrypted submission if *all* examinees or *this* examinee is queried
                    returned_examinee_data[encrypted_submission_file.name] = examinee.get_encrypted_submission(encrypted_submission_file.name)
                    returned_examinee_data[encrypted_submission_file.name + ".sig"] = examinee.get_encrypted_submission_signature(encrypted_submission_file.name)
                requires_file_mapping_to_be_included = True

        # if user has permissions to read encrypted submission files, also provide the file-mapping.enc file
        if requires_file_mapping_to_be_included is True and exam_user.has_permission(DownloadExamineeDataPermission.create('file-mapping', examinee.get_identifier())):
            returned_examinee_data['file-mapping.enc'] = examinee.get_encrypted_file_mapping()
            returned_examinee_data['file-mapping.enc.sig'] = examinee.get_encrypted_file_mapping_signature()

        data_to_return[examinee.get_identifier()] = returned_examinee_data

    return jsonify(data_to_return)


@bp.route('/points', methods=['GET'])
@exam_and_user_must_be_set
@only_graders_or_during_review_allowed
def get_examinees_grading_points():
    exam, exam_user = get_exam_and_user()
    examinees = exam.get_examinees()

    # if this is not None, only include the gradings of this examinee
    target_examinee = request.args.get('examineeIdentifier', None)

    data_to_return = dict()
    for examinee in examinees.values():
        returned_examinee_data = dict()
        file_mapping_needed = False

        if not (target_examinee is None or target_examinee == examinee.get_identifier()):
            continue

        if not exam_user.has_permission(DownloadExamineeDataPermission.create('anonymized-data', examinee.get_identifier())):
            # without this permission, an ExamUser is not allowed to learn that the given examinee exists
            continue

        # include the reassessment-result.enc file when the ExamUser has the permission AND the file exists
        if exam_user.has_permission(DownloadExamineeDataPermission.create('reassessment-result', examinee.get_identifier())) and examinee.get_encrypted_reassessment_result_file().is_file():
            file_mapping_needed = True
            returned_examinee_data['reassessment-result.enc'] = examinee.get_encrypted_reassessment_result()

        # include the encrypted post-exam review credentials of this examinee (when the ExamUser has the required permissions)
        if exam_user.has_permission(DownloadExamineeDataPermission.create('post-exam-review-credentials', examinee.get_identifier())):
            returned_examinee_data['post-exam-review-credentials.enc'] = examinee.get_encrypted_post_exam_review_credentials()

        # include the boolean whether the examinee already looked at the post-exam review (when the ExamUser has the required permissions)
        if exam_user.has_permission(DownloadExamineeDataPermission.create('post-exam-review-accessed', examinee.get_identifier())):
            returned_examinee_data['post-exam-review-accessed'] = examinee.is_post_exam_review_accessed() is True

        encrypted_grading_points_files = examinee.get_encrypted_grading_points_files(include_signature_files=False)
        for encrypted_grading_points_file in encrypted_grading_points_files:
            # there is no separate permission for the signature file
            has_permission = exam_user.has_permission(DownloadGradingPointsPermission.create(examinee.get_identifier(), encrypted_grading_points_file.name))

            if has_permission:
                file_mapping_needed = True
                returned_examinee_data[encrypted_grading_points_file.name] = examinee.get_encrypted_grading_points(encrypted_grading_points_file.name)
                returned_examinee_data[encrypted_grading_points_file.name + ".sig"] = examinee.get_encrypted_grading_points_signature(encrypted_grading_points_file.name)

        # if user has permissions to read the files, also provide the file-mapping.enc file
        if file_mapping_needed is True and exam_user.has_permission(DownloadExamineeDataPermission.create('file-mapping', examinee.get_identifier())):
            returned_examinee_data['file-mapping.enc'] = examinee.get_encrypted_file_mapping()
            returned_examinee_data['file-mapping.enc.sig'] = examinee.get_encrypted_file_mapping_signature()

        if len(returned_examinee_data) > 0:
            data_to_return[examinee.get_identifier()] = returned_examinee_data

    if exam_user.has_permission(DownloadExamDataPermission.create('valid-public-keys')):
        data_to_return['valid-public-keys'] = {u.pseudonym: u.public_signing_key_hex for u in ExamUser.list_users(exam) if u.is_grader() and u.has_public_signing_key()}

    return jsonify(data_to_return)


@bp.route('/myself', methods=['GET'])
@exam_and_user_must_be_set
@only_graders_or_during_review_allowed
def get_own_user_data():
    exam, exam_user = get_exam_and_user()
    data_to_return = {
        "keys": exam_user.encrypted_keys,
        "permissions": exam_user.stringify_permissions(),
        "public_signing_key": exam_user.public_signing_key_hex,
        "pseudonym": exam_user.pseudonym,
        "encrypted_name": exam_user.encrypted_name_self,
    }

    return jsonify(data_to_return)


@bp.route('/pk', methods=['GET', 'PUT'])
@exam_and_user_must_be_set
def upload_signing_public_key():
    exam, exam_user = get_exam_and_user()

    # only graders can upload a public key
    if not exam_user.is_grader():
        return abort(403)

    if request.method == 'GET':
        challenge = exam_user.get_challenge()
        if challenge is None:
            challenge = exam_user.generate_fresh_challenge()
        return jsonify({"challenge": challenge})
    elif request.method == 'PUT':
        solved_challenge = request.json.get("solved_challenge", "")
        uploaded_public_key = request.json.get("public_signing_key", "")

        pattern = re.compile("^[0-9a-f]{64}$")
        if not pattern.fullmatch(uploaded_public_key.lower()):
            # provided public key does not have expected format
            return abort(400)

        if exam_user.public_signing_key_hex is not None:
            if uploaded_public_key != exam_user.public_signing_key_hex:
                # there is already a public key on the server that is different from the provided one => reject
                return abort(403)
            else:
                # there is a public key that is identical to the uploaded key => no need to verify the challenge as nothing is changed
                return jsonify({"success": True, "message": "Uploaded public key is identical"})
        else:
            # verify the challenge before saving it as the new public key
            if exam_user.verify_challenge(solved_challenge, uploaded_public_key):
                # storing the public key automatically clears the challenge (by deleting the file)
                exam_user.store_public_signing_key(uploaded_public_key)
                return jsonify({"success": True, "message": "Uploaded public key"})
            else:
                return abort(401)
    else:
        return abort(405)


@bp.route("/grade", methods=["PUT"])
@exam_and_user_must_be_set
def upload_encrypted_gradings():

    exam, exam_user = get_exam_and_user()

    # only accept grading when the current exam phase actually is grading
    if exam.get_exam_phase() != 'grading':
        return abort(400)

    savable_gradings = request.json.get("gradings", [])

    if type(savable_gradings) is not list:
        return abort(400)

    error_due_to_wrong_data = False
    error_due_to_insufficient_permissions = False
    successful_saves = []

    for savable_grading in savable_gradings:
        if type(savable_grading) is not dict:
            error_due_to_wrong_data = True
            continue

        encrypted_grading_base64 = savable_grading.get("grading", None)
        grading_signature_hex = savable_grading.get("signature", None)
        examinee_identifier = savable_grading.get("examinee", None)
        grading_points_file_name = savable_grading.get("file", None)

        _to_verify = [encrypted_grading_base64, grading_signature_hex, examinee_identifier, grading_points_file_name]
        if not all(x is not None and type(x) is str and len(x.strip()) > 0 for x in _to_verify):
            error_due_to_wrong_data = True
            continue

        # check whether the given examinee identifier is valid (also checks for none identifiers)
        examinee = exam.get_examinee(examinee_identifier)
        if examinee is None:
            error_due_to_wrong_data = True
            continue

        # reject mapped file names that do *not* already exist (prevents uploading arbitrary files)
        valid_grading_points_file_names = [f.name for f in examinee.get_encrypted_grading_points_files(include_signature_files=False)]
        if grading_points_file_name not in valid_grading_points_file_names:
            error_due_to_wrong_data = True
            continue

        # check whether the user has permission to modify the grading files
        required_permission = UploadGradingPointsPermission.create(examinee.get_identifier(), grading_points_file_name)
        if not exam_user.has_permission(required_permission):
            error_due_to_insufficient_permissions = True
            continue

        # reject gradings that are not signed by this exam user private key
        try:
            if not examinee.verify_encrypted_grading_point_signature(exam.exam_name, exam_user.public_signing_key_hex, grading_points_file_name, encrypted_grading_base64, grading_signature_hex):
                error_due_to_insufficient_permissions = True
                continue
        except:
            error_due_to_wrong_data = True
            continue

        try:
            examinee.save_encrypted_grading_points_file(exam.exam_name, grading_points_file_name, encrypted_grading_base64, grading_signature_hex, exam_user.public_signing_key_hex)
            successful_saves.append((examinee.get_identifier(), grading_points_file_name))
        except Exception as e:
            error_due_to_wrong_data = True
            continue

    if len(successful_saves) == 0:
        # there were no successful saves => return corresponding http error status
        return abort(403) if error_due_to_insufficient_permissions is True else abort(400)

    # there was at least one successful saves
    if error_due_to_insufficient_permissions is True or error_due_to_wrong_data is True:
        return jsonify({"successful": successful_saves}), 207
    else:
        return "", 201


@bp.route("/reassessment", methods=["PUT"])
@exam_and_user_must_be_set
def upload_reassessment_result():
    exam, exam_user = get_exam_and_user()

    if exam.get_exam_phase() != 'reassessment':
        return abort(400)

    savable_reassessments = request.json.get("reassessments", [])

    if type(savable_reassessments) is not list:
        return abort(400)

    for savable_reassessment in savable_reassessments:
        if type(savable_reassessment) is not dict:
            return abort(400)

        examinee_identifier = savable_reassessment.get("examinee", None)
        encrypted_reassessment_base64 = savable_reassessment.get("reassessment", None)

        _to_verify = [examinee_identifier, encrypted_reassessment_base64]
        if not all(x is not None and type(x) is str and len(x.strip()) > 0 and len(x) <= 1024 for x in _to_verify):
            return abort(400)

        # check whether the given examinee identifier is valid (also checks for none identifiers)
        examinee = exam.get_examinee(examinee_identifier)
        if examinee is None:
            return abort(400)

        # check whether the user has permission to upload the reassessment result file
        grading_permission = UploadReassessmentResultPermission.create(examinee.get_identifier())
        if not exam_user.has_permission(grading_permission):
            return abort(403)

        # reject reassessments by an ExamUser that has also the permission to modify the grading files
        encrypted_grading_point_files = examinee.get_encrypted_grading_points_files()
        if any(exam_user.has_permission(UploadGradingPointsPermission.create(examinee.get_identifier(), grading_point_file.name)) for grading_point_file in encrypted_grading_point_files):
            return abort(403)

        try:
            examinee.save_reassessment_result_file(encrypted_reassessment_base64)
        except Exception as e:
            return abort(400)

    return "", 201


