import base64
import datetime
import json
import re
from dataclasses import asdict
from pathlib import Path

from app import config
from app.models.naclcrypto import SignatureVerifier
from app.models.exam_template_models import ExamJSONFile, TasksJSONFile


class Exam:
    def __init__(self, exam_directory):
        self.exam_data_directory = exam_directory
        self.exam_name = exam_directory.name

    def get_task_templates(self):
        tasks_directory = self._get_task_templates_path()
        if not tasks_directory.exists():
            raise Exception('No task templates for exam', self.exam_name)
        return sorted([f.name for f in tasks_directory.glob('*.html') if f.is_file()])

    def get_relative_task_template_path(self, task_template_name):
        tasks_directory = self._get_task_templates_path()
        valid_templates = self.get_task_templates()
        if task_template_name in valid_templates:
            return tasks_directory.joinpath(task_template_name)
        else:
            return None

    def get_relative_resources_path(self, resource_file_name):
        resources_directory = self.get_resources_directory()
        if not resources_directory.exists():
            raise Exception('No resources directory for exam', self.exam_name)
        valid_resources = [f.name for f in resources_directory.iterdir() if f.is_file()]
        if resource_file_name not in valid_resources:
            return None
        return resources_directory.joinpath(resource_file_name)

    def get_examinees(self):
        return Examinee.list_examinees(self.exam_data_directory.joinpath("examinees"))

    def get_examinee(self, examinee_identifier):
        if examinee_identifier is None or len(examinee_identifier) == 0:
            return None
        examinees = self.get_examinees()
        return examinees.get(examinee_identifier, None)

    def get_public_exam_meta_data(self):
        # note: only extract the name, shortname, and date here
        exam_json = ExamJSONFile.load_file(self.exam_data_directory.joinpath('exam-files'))

        return {
            'name': exam_json.name,
            'shortname': exam_json.shortname,
            'date': exam_json.date
        }

    def get_tasks_json_data(self):
        tasks_json = TasksJSONFile.load_file(self.exam_data_directory.joinpath('exam-files'))
        return [asdict(task) for task in tasks_json.tasks]

    def get_grade_calculation(self):
        grade_calculation_file = self._get_exam_grade_calculation_path()
        if not grade_calculation_file.exists():
            raise Exception("No grade calculation file for exam", self.exam_name)

        with open(grade_calculation_file) as f:
            grade_calculation = json.load(f)

        return grade_calculation

    def save_grade_calculation(self, grade_calculation):
        grade_calculation_file = self._get_exam_grade_calculation_path()

        if 'passed-limit' not in grade_calculation:
            raise ValueError('Passed limit is missing')
        if type(grade_calculation['passed-limit']) is not int or grade_calculation['passed-limit'] <= 0:
            raise ValueError('Passed limit is invalid and must be greater than 0')
        if 'grade-limits' not in grade_calculation:
            raise ValueError('Grade limits are missing')
        if type(grade_calculation['grade-limits']) is not list:
            raise ValueError('Grade limits are invalid (type must be list)')

        prev_better_grade_points = None
        for (grade, points_limit) in grade_calculation['grade-limits']:
            if type(grade) is not str:
                raise ValueError('Grade entries must be of type str')
            if type(points_limit) is not int:
                raise ValueError('Point limits for grades must be of type int')
            if prev_better_grade_points is not None and points_limit > prev_better_grade_points:
                raise ValueError(f'The grade point limit for grade {grade} of {points_limit} points must be smaller or equal to the required points {prev_better_grade_points} for the better grade')
            prev_better_grade_points = points_limit

        with open(grade_calculation_file, 'w') as f:
            m = {'grade-calculation': grade_calculation}
            json.dump(m, f)

    def get_exam_phase(self):
        exam_phase_file = self._get_exam_phase_path()
        if not exam_phase_file.is_file():
            raise Exception("No exam phase for the given exam", self.exam_name)

        with open(exam_phase_file) as f:
            exam_phase = f.readline().strip()

        return exam_phase

    def save_exam_phase(self, exam_phase):
        if exam_phase not in ['grading', 'reassessment', 'review']:
            raise ValueError("Invalid exam phase")

        with open(self._get_exam_phase_path(), 'w') as f:
            f.write(exam_phase)

    def save_review_config(self, timeframe_from, timeframe_until):
        if type(timeframe_from) is not datetime.date:
            raise ValueError("timeframe_from must be a valid date")
        if type(timeframe_until) is not datetime.date:
            raise ValueError("timeframe_until must be a valid date")
        if timeframe_from > timeframe_until:
            raise ValueError("timeframe_from cannot be greater than timeframe_until")

        with open(self._get_review_config_file(), "w") as f:
            json.dump({'timeframe_from': timeframe_from.isoformat(), 'timeframe_until': timeframe_until.isoformat()}, f)

    def get_review_config(self):
        if not self._get_review_config_file().is_file():
            raise Exception("No review config file found")
        with open(self._get_review_config_file()) as f:
            review_config = json.load(f)

        if type(review_config.get('timeframe_from', None)) is not str:
            raise ValueError("Invalid content for timeframe_from in review config")
        if type(review_config.get('timeframe_until', None)) is not str:
            raise ValueError("Invalid content for timeframe_until in review config")

        timeframe_from = datetime.date.fromisoformat(review_config.get('timeframe_from'))
        timeframe_until = datetime.date.fromisoformat(review_config.get('timeframe_until'))

        return {
            'timeframe_from': timeframe_from,
            'timeframe_until': timeframe_until
        }

    def is_review_allowed(self):
        review_config = self.get_review_config()
        return self.get_exam_phase() == 'review' and review_config['timeframe_from'] <= datetime.date.today() <= review_config['timeframe_until']

    def get_users_directory(self):
        return self.exam_data_directory.joinpath('users')

    def get_resources_directory(self):
        return self.exam_data_directory.joinpath('exam-files').joinpath('resources')

    def _get_task_templates_path(self):
        return self.exam_data_directory.joinpath('exam-files').joinpath('tasks')

    def _get_exam_grade_calculation_path(self):
        return self.exam_data_directory.joinpath('grade-calculation.json')

    def _get_exam_phase_path(self):
        return self.exam_data_directory.joinpath('exam-phase.txt')

    def _get_review_config_file(self):
        return self.exam_data_directory.joinpath('review-config.json')

    @classmethod
    def get(cls, exam_name):
        exams_directory = Path(config.EXAM_DATA_DIRECTORY)

        if exam_name not in Exam.list_exams():  # prevents path traversal attacks
            return None

        exam_directory = exams_directory.joinpath(exam_name)
        if exam_directory.exists() and exams_directory.is_dir():
            return cls(exam_directory)
        else:
            return None

    @staticmethod
    def list_exams():
        exams_directory = Path(config.EXAM_DATA_DIRECTORY)
        return [f.name for f in exams_directory.iterdir() if f.is_dir()]


class Examinee:
    def __init__(self, first_name, last_name, directory):
        self.first_name = first_name
        self.last_name = last_name
        self.directory = directory

    def get_identifier(self):
        return self.directory.name

    def get_anonymized_name(self):
        return self.first_name + " " + self.last_name

    def get_encrypted_personal_data(self):
        with open(self._get_encrypted_personal_data_file()) as f:
            return f.read()

    def get_encrypted_personal_data_signature(self):
        with open(self._get_encrypted_personal_data_sig_file()) as f:
            return json.load(f)

    def get_encrypted_file_mapping(self):
        with open(self._get_encrypted_file_mapping_file()) as f:
            return f.read()

    def get_encrypted_file_mapping_signature(self):
        with open(self._get_encrypted_file_mapping_signature_file()) as f:
            return json.load(f)

    def get_encrypted_reassessment_result(self):
        with open(self.get_encrypted_reassessment_result_file()) as f:
            return f.read()

    def get_encrypted_post_exam_review_credentials(self):
        with open(self._get_encrypted_post_exam_review_credentials_file()) as f:
            return f.read()

    def get_encrypted_submission(self, submission_name):
        with open(self._get_encrypted_submission_file(submission_name), 'r') as f:
            return f.read()

    def get_encrypted_submission_signature(self, submission_name):
        with open(self._get_signature_file_for_submission(submission_name), 'r') as f:
            return json.load(f)

    def get_encrypted_grading_points(self, grading_points_file_name):
        with open(self._get_encrypted_grading_points_file(grading_points_file_name), 'r') as f:
            return f.read()

    def get_encrypted_grading_points_signature(self, grading_points_file_name):
        with open(self.get_signature_file_for_grading_points(grading_points_file_name), 'r') as f:
            return json.load(f)

    def get_encrypted_submission_files(self):
        return [f for f in self._get_encrypted_submissions_dir().iterdir() if f.is_file() and f.suffix == '.enc']

    def get_encrypted_grading_points_files(self, include_signature_files=False):
        return [f for f in self._get_encrypted_grading_points_dir().iterdir() if f.is_file() and (f.suffix == '.enc' or (include_signature_files is True and f.suffix == '.sig'))]

    def get_file_signature_prefix(self, exam_name, file_name):
        return (exam_name + "+" + self.get_identifier() + "+" + file_name + "+").encode("utf-8")

    def get_file_signature_message(self, exam_name, file_name, file_content_bytes):
        return self.get_file_signature_prefix(exam_name, file_name) + file_content_bytes

    def verify_encrypted_grading_point_signature(self, exam_name, public_key, grading_points_file_name, grading_points_content_base64, signature_hex):
        verifier = SignatureVerifier(public_key)
        signed_message = self.get_file_signature_message(exam_name, grading_points_file_name, base64.b64decode(grading_points_content_base64))
        return verifier.is_signature_valid(signed_message, signature_hex)

    def verify_encrypted_submissions_signature(self, exam_name, public_key, submission_file_name, submission_content_base64, signature_hex):
        verifier = SignatureVerifier(public_key)
        signed_message = self.get_file_signature_message(exam_name, submission_file_name, base64.b64decode(submission_content_base64))
        return verifier.is_signature_valid(signed_message, signature_hex)

    def save_encrypted_grading_points_file(self, exam_name, grading_points_file_name, grading_points_content_base64, file_signature_hex, exam_user_public_key, file_must_exist=True, verify_signature=True):
        grading_file = self._get_encrypted_grading_points_file(grading_points_file_name, file_must_exist=file_must_exist)
        if grading_points_content_base64 is None or len(grading_points_content_base64) == 0:
            raise Exception("Cannot write empty content to grading file", grading_file)

        if file_signature_hex is None or len(file_signature_hex.strip()) == 0:
            raise Exception("Cannot write to grading file with invalid signature", grading_file)

        if verify_signature is True and (not self.verify_encrypted_grading_point_signature(exam_name, exam_user_public_key, grading_points_file_name, grading_points_content_base64, file_signature_hex)):
            raise Exception("Signature for grading file is invalid")

        # reset that the examinee has accessed the post exam review page (because the gradings might have changed)
        self.set_post_exam_review_accessed(False)

        with open(grading_file, 'w') as f:
            f.write(grading_points_content_base64)

        signature_file = self.get_signature_file_for_grading_points(grading_points_file_name)
        with open(signature_file, 'w') as f:
            json.dump({
                "signature": file_signature_hex,
                "public_key": exam_user_public_key
            }, f)

    def save_reassessment_result_file(self, encrypted_reassessment_base64):
        reassessment_file = self.get_encrypted_reassessment_result_file()

        if encrypted_reassessment_base64 is None or len(encrypted_reassessment_base64) == 0:
            raise Exception("Cannot write empty approved to reassessment file", reassessment_file)

        try:
            base64.b64decode(encrypted_reassessment_base64, validate=True)
        except:
            raise ValueError("Invalid base64 string")

        with open(reassessment_file, 'w') as f:
            f.write(encrypted_reassessment_base64)

    def is_post_exam_review_accessed(self):
        if self._get_post_exam_review_accessed_file().is_file():
            with open(self._get_post_exam_review_accessed_file(), 'r') as f:
                return f.read() == 'true'

        return False

    def set_post_exam_review_accessed(self, accessed):
        file = self._get_post_exam_review_accessed_file()

        content = 'true' if accessed else 'false'
        with open(file, 'w') as f:
            f.write(content)

    def get_signature_file_for_grading_points(self, grading_points_file_name):
        # note: this prevents LFIs
        file_pattern = r'[0-9a-f]{16}.enc'
        if not re.fullmatch(file_pattern, grading_points_file_name):
            raise ValueError("Grading points file name does not match pattern")

        return self._get_encrypted_grading_points_dir().joinpath(grading_points_file_name + ".sig")

    def _get_signature_file_for_submission(self, submission_file_name):
        return self._get_encrypted_submissions_dir().joinpath(submission_file_name + ".sig")

    def _get_encrypted_submissions_dir(self):
        return self.directory.joinpath("enc-submissions")

    def _get_encrypted_grading_points_dir(self):
        return self.directory.joinpath("enc-grading-points")

    def _get_encrypted_personal_data_file(self):
        return self.directory.joinpath("personal-data.enc")

    def _get_encrypted_personal_data_sig_file(self):
        return self.directory.joinpath("personal-data.enc.sig")

    def get_encrypted_reassessment_result_file(self):
        return self.directory.joinpath("reassessment-result.enc")

    def _get_encrypted_file_mapping_file(self):
        return self.directory.joinpath("file-mapping.enc")

    def _get_encrypted_file_mapping_signature_file(self):
        return self.directory.joinpath("file-mapping.enc.sig")

    def _get_encrypted_post_exam_review_credentials_file(self):
        return self.directory.joinpath("post-exam-review-credentials.enc")

    def _get_encrypted_submission_file(self, submission_file_name):
        # note: this prevents LFIs
        file_pattern = r'[0-9a-f]{16}.enc'
        if not re.fullmatch(file_pattern, submission_file_name):
            raise ValueError("Submission file name does not match pattern")
        f = self._get_encrypted_submissions_dir().joinpath(submission_file_name)
        if not f.is_file():
            raise ValueError("Submission file does not exist")
        return f

    def _get_encrypted_grading_points_file(self, grading_points_file_name, file_must_exist=True):
        # note: this prevents LFIs
        file_pattern = r'[0-9a-f]{16}.enc'
        if not re.fullmatch(file_pattern, grading_points_file_name):
            raise ValueError("Grading points file name does not match pattern")
        f = self._get_encrypted_grading_points_dir().joinpath(grading_points_file_name)
        if file_must_exist is True and not f.is_file():
            raise ValueError("Grading points file does not exist")
        return f

    def _get_post_exam_review_accessed_file(self):
        return self.directory.joinpath('post-exam-review-accessed.json')

    @classmethod
    def from_directory(cls, examinee_directory):
        with open(examinee_directory.joinpath("anonymized-data.student"), "r") as f:
            anonymized_student = json.load(f)

        return cls(anonymized_student['first_name'], anonymized_student['last_name'], examinee_directory)

    @staticmethod
    def list_examinees(examinees_directory):
        return {examinee_directory.name: Examinee.from_directory(examinee_directory) for examinee_directory in examinees_directory.iterdir() if examinee_directory.is_dir()}


class ExamGradingInfo:
    def __init__(self, grade_limits):
        self.grade_limits = grade_limits

    @classmethod
    def from_file(cls, exam_grading_info_file):
        with open(exam_grading_info_file, 'r') as f:
            exam_grading_info = json.load(f)

        return cls(exam_grading_info['grade-limits'])
