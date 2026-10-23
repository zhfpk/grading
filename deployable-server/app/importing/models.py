import csv
import json
import logging
import secrets
from enum import Enum
from math import ceil

from app.models.exam_template_models import TasksJSONFile, SubmissionType, ExamJSONFile
from app.models.naclcrypto import SymmetricEncryptor


class RoomSecretString:
    PREFIX = "X"

    def __init__(self, exam_name, seat_number, student_id, last_name, first_name, room_secret):
        self.exam_name = exam_name
        self.seat_number = seat_number
        self.student_id = student_id
        """ Uses the ASCII representation of the original last name (ö => oe; è => e, etc) """
        self.last_name = last_name
        """ Uses the ASCII representation of the original first name (ö => oe; è => e, etc) """
        self.first_name = first_name
        self.room_secret = room_secret

    def get_string(self):
        if self.exam_name is None:
            return '_'.join([RoomSecretString.PREFIX, self.seat_number, self.student_id, self.last_name, self.first_name, self.room_secret])
        else:
            return '_'.join([RoomSecretString.PREFIX, self.exam_name, self.seat_number, self.student_id, self.last_name, self.first_name, self.room_secret])

    def __repr__(self):
        return self.get_string()

    @classmethod
    def from_string(cls, room_secret_string, separator="_"):
        # X_<seat-number>_<student-id>_<lastname>_<first-firstname>_<room-secret>                   => 6 elements
        # or X_<exam-name>_<seat-number>_<student-id>_<lastname>_<first-firstname>_<room-secret>    => 7 elements

        if room_secret_string.count(separator) != 5 and room_secret_string.count(separator) != 6:
            raise ValueError("Room secret string must have 5 or 6 separators", room_secret_string)

        exam_name = None
        if room_secret_string.count(separator) == 5:
            prefix, seat_number, student_id, last_name, first_name, room_secret = room_secret_string.split(separator)
        else:
            prefix, exam_name, seat_number, student_id, last_name, first_name, room_secret = room_secret_string.split(separator)

        if prefix != cls.PREFIX:
            raise ValueError("Room secret string must have prefix {}".format(cls.PREFIX))

        return cls(exam_name, seat_number, student_id, last_name, first_name, room_secret)


class ImportableExam:
    def __init__(self, source_exam_directory):
        self.source_exam_directory = source_exam_directory

    def get_default_grade_limits(self):
        ordered_pass_grades = ['1.0', '1.3', '1.7', '2.0', '2.3', '2.7', '3.0', '3.3', '3.7', '4.0']
        tasks_json = self.get_exam_tasks_json()
        max_points = tasks_json.calculate_exam_point_sum()
        passed_limit = int(round(0.5 * max_points))
        grade_limits = [["5.0", 0]]
        for i, grade in enumerate(reversed(ordered_pass_grades)):
            grade_limit = passed_limit + i * (passed_limit / len(ordered_pass_grades))
            grade_limits.insert(0, [grade, int(round(grade_limit))])

        return grade_limits

    def get_exam_tasks_json(self):
        return TasksJSONFile.load_file(self.source_exam_directory.joinpath('exam-files'))

    def get_exam_json(self):
        return ExamJSONFile.load_file(self.source_exam_directory.joinpath('exam-files'))

    def get_exam_template_directory(self):
        return self.source_exam_directory.joinpath('exam-files')

    def get_importable_uploads(self):
        uploads_path = self.source_exam_directory.joinpath("uploaded-files")
        uploads = []
        for upload_path in uploads_path.iterdir():
            if not upload_path.is_dir():
                continue
            uploads.append(ImportableUpload(upload_path))

        return uploads

    def get_room_secret_mapping(self):
        room_secret_file = self.source_exam_directory.joinpath("roomsecret-mapping.txt")
        with open(room_secret_file) as f:
            lines = f.readlines()

        # check whether all the room secrets have the same exam name (if present) and the same actual room secret
        # note: it is sufficient to check the room secrets from the mapping because the actual uploaded room.secret files are later compared to these expected values, so if the room secrets in the mapping are correct, the others are too
        first_found_room_secret = None

        mapping = dict()
        for line in lines[1:]:
            room_secret_string, mac, device_secret = line.strip().split(";")
            current_room_secret_string_obj = RoomSecretString.from_string(room_secret_string)
            mapping[device_secret] = (mac, current_room_secret_string_obj)
            if first_found_room_secret is None:
                first_found_room_secret = current_room_secret_string_obj
                logging.info(f"Room secret for the exam with the name '{current_room_secret_string_obj.exam_name}' seems to be {first_found_room_secret}")
            if first_found_room_secret.room_secret != current_room_secret_string_obj.room_secret:
                raise Exception("There is a different room secret for the same exam; this should never be the case!")
            if first_found_room_secret.exam_name != current_room_secret_string_obj.exam_name:
                raise Exception("You are trying to import different exams into one exam; this should never be the case. Room secret string contains different exam names: ", first_found_room_secret.exam_name, current_room_secret_string_obj.exam_name)
            logging.info(f"Found room secret mapping for {device_secret}: {room_secret_string}")

        return mapping

    def get_registrations(self):
        registrations = dict()
        registrations_file = self.source_exam_directory.joinpath("registrations.csv")
        with open(registrations_file, "r") as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                registrations[row['Nr'].strip()] = {
                    'seat_number': row['Nr'].strip(),
                    'student_id': row['Matrnr'].strip(),
                    'last_name': row['Nachname'].strip(),
                    'first_name': row['Vorname'].strip()
                }
        return registrations


class EncryptedExamineeFileStore:
    def __init__(self, root_examinee_directory, padding_target_bytes):
        self.root_examinee_directory = root_examinee_directory
        self.padding_target = padding_target_bytes
        self.original_file_to_encrypted_file = dict()
        self.encrypted_file_to_key = dict()
        self.auxiliary_keys = dict()
        self.padding_prefix_length = 5

    def mkdir_submissions_dir(self):
        enc_submission_directory = self._get_enc_submissions_directory()
        enc_submission_directory.mkdir(exist_ok=True)
        return enc_submission_directory

    def store_submission(self, original_file_name, plaintext):
        enc_submission_directory = self.mkdir_submissions_dir()

        taken_names = set(f.name for f in enc_submission_directory.iterdir() if f.is_file())

        if original_file_name in self.original_file_to_encrypted_file:
            # overwriting a previously generated file => bad
            raise Exception("Encrypted submission file already exists", original_file_name)

        random_file_name = self._create_unique_random_name(taken_names)
        self.original_file_to_encrypted_file[original_file_name] = random_file_name
        encrypted_file_path = enc_submission_directory.joinpath(random_file_name)

        plaintext_str = plaintext if plaintext is not None else ""
        padded_plaintext = self._pad_to_target_size(plaintext_str)
        key_bytes = self.symmetric_encrypt_and_write_to_file(encrypted_file_path, padded_plaintext)
        self.encrypted_file_to_key[random_file_name] = key_bytes
        return encrypted_file_path

    def mkdir_grading_points_dir(self):
        enc_gradings_directory = self._get_enc_gradings_directory()
        enc_gradings_directory.mkdir(exist_ok=True)

    def store_grading_points(self, original_file_name, points=None, comment=None, annotation=None, grading_type=None):
        enc_gradings_directory = self._get_enc_gradings_directory()
        enc_gradings_directory.mkdir(exist_ok=True)

        taken_names = set(f.name for f in enc_gradings_directory.iterdir() if f.is_file())

        if original_file_name in self.original_file_to_encrypted_file:
            # overwriting a previously generated file => bad
            raise Exception("Encrypted grading file already exists", original_file_name)

        random_file_name = self._create_unique_random_name(taken_names)
        self.original_file_to_encrypted_file[original_file_name] = random_file_name
        encrypted_file_path = enc_gradings_directory.joinpath(random_file_name)

        sym_encryptor_annotation = SymmetricEncryptor()
        encrypted_annotation = sym_encryptor_annotation.encrypt(json.dumps(annotation))

        sym_encryptor_grading_type = SymmetricEncryptor()
        encrypted_grading_type = sym_encryptor_grading_type.encrypt(json.dumps(grading_type))

        plaintext = json.dumps({
            "points": points,
            "comment": comment,
            "enc-annotation": encrypted_annotation,
            "enc-type": encrypted_grading_type
        })

        key_bytes_for_encrypted_grading_file = self.symmetric_encrypt_and_write_to_file(encrypted_file_path, plaintext)

        self.encrypted_file_to_key[random_file_name] = key_bytes_for_encrypted_grading_file
        self.auxiliary_keys[f'{original_file_name}+annotation'] = sym_encryptor_annotation.key_bytes
        self.auxiliary_keys[f'{original_file_name}+type'] = sym_encryptor_grading_type.key_bytes

        return encrypted_file_path

    def store_reassessment_result_file(self, importer_public_key):
        # note: add random bytes so that the file size does not leak anything
        plaintext = json.dumps({
            "approved": False,
            "grading-files-hash": secrets.token_hex(32),
            "answer-files-hash": secrets.token_hex(32),
            "signature": secrets.token_hex(64),
            "public-key": importer_public_key
        })

        self.store_examinee_file("reassessment-result.enc", plaintext)

    def store_examinee_file(self, filename, plaintext):
        file_path = self.root_examinee_directory.joinpath(filename)
        if file_path.is_file():
            raise Exception("Encrypted file already exists", file_path)
        key_bytes = self.symmetric_encrypt_and_write_to_file(file_path, plaintext)
        self.encrypted_file_to_key[filename] = key_bytes
        return file_path

    def store_file_mapping(self):
        json_mapping = json.dumps(self.original_file_to_encrypted_file)
        return self.store_examinee_file("file-mapping.enc", json_mapping)

    def export_keys_for_post_exam_review(self):
        allowed_file_names = {'personal-data.enc', 'reassessment-result.enc', 'file-mapping.enc', 'data.student', 'exam.handin'}
        allowed_submission_files = {'data.student', 'exam.handin'}
        allowed_file_names.update(submission_file_random_name for submission_file, submission_file_random_name in self.original_file_to_encrypted_file.items() if submission_file.endswith('.answer') or submission_file in allowed_submission_files)
        allowed_file_names.update(points_file_random_name for points_file, points_file_random_name in self.original_file_to_encrypted_file.items() if points_file.endswith('.points'))

        allowed_auxiliary_names = set()

        return {
            "file-keys": {
                k: v.hex() for k, v in self.encrypted_file_to_key.items() if k in allowed_file_names
            },
            "auxiliary-keys": {
                k: v.hex() for k, v in self.auxiliary_keys.items() if k in allowed_auxiliary_names
            }
        }

    def export_all_keys(self):
        return {
            "file-keys": {
               k: v.hex() for k, v in self.encrypted_file_to_key.items()
            },
            "auxiliary-keys": {
                k: v.hex() for k, v in self.auxiliary_keys.items()
            }
        }

    def symmetric_encrypt_and_write_to_file(self, encrypted_file_path, plaintext):
        sym_encryptor = SymmetricEncryptor()

        if encrypted_file_path.is_file():
            raise Exception("File already exists. Cannot overwrite the encrypted file at given path", encrypted_file_path)

        ciphertext = sym_encryptor.encrypt(plaintext)

        with open(encrypted_file_path, 'w', encoding='utf-8') as f:
            f.write(ciphertext)

        return sym_encryptor.key_bytes

    def _create_unique_random_name(self, taken_names):
        while True:
            random_file_name = secrets.token_hex(8) + ".enc"
            if random_file_name not in taken_names:
                return random_file_name

    def _get_enc_submissions_directory(self):
        return self.root_examinee_directory.joinpath("enc-submissions")

    def _get_enc_gradings_directory(self):
        return self.root_examinee_directory.joinpath("enc-grading-points")

    def _pad_to_target_size(self, message):
        if len(message.encode('utf-8')) > self.padding_target:
            raise Exception("Padding error. Cannot pad message to target padding length as message is too long. Please adjust the target padding length in the importer.")
        needed_padding = self.padding_target - len(message.encode('utf-8'))

        # we choose a random padding
        padding = secrets.token_hex(ceil(needed_padding/2))[:needed_padding]

        prefix = str(needed_padding).zfill(self.padding_prefix_length) # we chose a human-readable prefix
        if len(prefix) != self.padding_prefix_length:
            raise Exception("Invalid padding prefix length. Adjust expected length if needed.")

        expected_size = self.padding_target + self.padding_prefix_length
        actual_size = len((prefix + message + padding).encode('utf-8'))

        if actual_size != expected_size:
            raise Exception(f"Unexpected error with the padding system. Padded message size {actual_size} does not match expected size {expected_size}")

        return prefix + message + padding


class ImportableUpload:
    def __init__(self, upload_path):
        self.upload_path = upload_path
        self.dirname = upload_path.name

    def read_student_data(self):
        with open(self._get_student_data_path(), 'r') as f:
            return json.load(f)

    def read_device_secret(self):
        with open(self._get_device_secret_path(), 'r') as f:
            return f.read()

    def read_room_secret(self):
        with open(self._get_room_secret_path(), 'r') as f:
            return f.read()

    def has_device_secret(self):
        return self._get_device_secret_path().exists()

    def has_student_data(self):
        return self._get_student_data_path().exists()

    def has_room_secret(self):
        return self._get_room_secret_path().exists()

    def chose_no_grading(self):
        if self._get_submissions_dir().joinpath('exam.handin').is_file():
            with open(self._get_submissions_dir().joinpath('exam.handin'), 'r') as f:
                content = f.read()
                if content == 'nograding=true':
                    return True
        return False

    def get_all_uploaded_submission_files_names(self):
        return [f.name for f in self._get_submissions_dir().iterdir() if f.is_file()]

    def get_submission_file_content(self, submission_file_name):
        file_path = self._get_submissions_dir().joinpath(submission_file_name)
        if file_path.exists() and file_path.is_file():
            with open(file_path, 'r') as f:
                return f.read()
        else:
            return None

    def submission_fields_are_none_or_empty(self, subtask):
        submissions_dir = self._get_submissions_dir()
        for answer_file in subtask.get_valid_answer_files():
            field_submission_file_path = submissions_dir.joinpath(answer_file)
            if not field_submission_file_path.exists():
                # if there is no file, then the submission field is None
                continue
            with open(field_submission_file_path, 'r') as f:
                submission_field_content = f.read()
            if len(submission_field_content) != 0:
                # if there is non-empty content in the file, return false
                return False

        # there is no content for all field submission files or the file doesn't even exist
        return True

    def has_actual_submissions(self):
        globs = [f'*.{submission_type.value}' for submission_type in SubmissionType]
        return any(len([f for f in self._get_submissions_dir().glob(glob)]) > 0 for glob in globs)

    def _get_device_secret_path(self):
        return self._get_submissions_dir().joinpath('device.secret')

    def _get_room_secret_path(self):
        return self._get_submissions_dir().joinpath('room.secret')

    def _get_student_data_path(self):
        return self._get_submissions_dir().joinpath('data.student')

    def _get_submissions_dir(self):
        return self.upload_path.joinpath('submissions')


    def __repr__(self):
        device_secret = None
        if self.has_device_secret():
            device_secret = self.read_device_secret()

        return f'Upload[path={self.dirname};secret={device_secret}]'


class GradingType(Enum):
    INDIVIDUAL_GRADING = 1
    GROUP_GRADING = 2
    AUTOMATIC_GRADING = 3



