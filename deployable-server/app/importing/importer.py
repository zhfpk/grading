import datetime
import json
import logging
import secrets
import shutil
from collections import Counter

from unidecode import unidecode

from app import Exam
from app.models.auth import ExamUser
from app.models.exams import Examinee
from app.importing.models import ImportableExam, EncryptedExamineeFileStore, SubmissionType, GradingType
from app.models.naclcrypto import Signer, AsymmetricEncryptor, SymmetricEncryptor
from app.models.utils import RandomNameGenerator

IMPORTER_CONFIG_SUBMISSION_SIGNER_SEED = "565c54b439fa208067e38c965b75d585e26dc2a641e588daea0e1f07bc39d34c" # IMPORTANT: Published in the submission for simplicity. Differs from key used in production. Key *NOT* available to server.
                           # VERIFY KEY: 0fb8331fce82ded5540346184e3e906c7eb60d2631df41055995550a4dc35665


class ExamImporter:
    def __init__(self, source_exam_directory, target_exam_directory, local_keys_directory, padding_target):
        self.target_exam_directory = target_exam_directory
        self.importable_exam = ImportableExam(source_exam_directory)
        self.local_keys_directory = local_keys_directory
        self.padding_target = padding_target

        self.submission_signer = Signer(bytes.fromhex(IMPORTER_CONFIG_SUBMISSION_SIGNER_SEED))
        self.grading_signer = Signer()

        self.encrypted_file_stores = dict()
        self.exam_auxiliary_encryptor = dict()

        self._check_local_keys_file()
        self._check_directories()
        self._create_directories()

    def import_exam(self):
        self._import_upload_files()
        self._create_exam_auxiliary_keys()
        self._export_importer_files()
        self._export_owner_files()
        self._export_general_exam_files()
        self._copy_exam_template_files()

    def _import_upload_files(self):
        tasks_json = self.importable_exam.get_exam_tasks_json()

        valid_answer_files = tasks_json.get_valid_answer_files()
        valid_auxiliary_file_names = ["exam.handin"]
        valid_non_importable_file_names = ["data.student", "room.secret", "device.secret"]
        valid_submission_file_names = valid_auxiliary_file_names + valid_answer_files + valid_non_importable_file_names

        room_secret_mappings = self.importable_exam.get_room_secret_mapping()
        registrations = self.importable_exam.get_registrations()
        found_device_secrets = set()

        examinees_directory = self.target_exam_directory.joinpath("examinees")

        importable_uploads = self.importable_exam.get_importable_uploads()

        exam_name = self.target_exam_directory.name

        post_exam_review_users = dict()

        counter = Counter()
        for importable_upload in importable_uploads:
            logging.info(f"Processing upload {importable_upload}")

            all_uploaded_submission_files_names = importable_upload.get_all_uploaded_submission_files_names()
            logging.debug(f"Found the following submission files (total: {len(all_uploaded_submission_files_names)}): {all_uploaded_submission_files_names}")
            for upload_submission_file in all_uploaded_submission_files_names:
                if upload_submission_file not in valid_submission_file_names:
                    raise Exception(f"Detected invalid submission file '{upload_submission_file}' in upload {importable_upload}")

            device_secret = importable_upload.read_device_secret()
            if device_secret in found_device_secrets:
                raise Exception("Identical device secret found. There is something wrong!", importable_upload)
            found_device_secrets.add(device_secret)

            _, room_secret_obj = room_secret_mappings.get(device_secret, (None, None))
            if room_secret_obj is None:
                # the device secret is not part of the mapping (a device that uploaded a submission but is not known)
                if importable_upload.has_student_data() or importable_upload.has_actual_submissions():
                    # someone was at this device
                    raise Exception("Upload directory does have data.student file or actual submission files but device secret is unknown to the room secret mappings", importable_upload, importable_upload.read_student_data())

                # else: no one was at this device and no one should have been on this device => it is a backup device
                logging.info(f"{device_secret} is an backup device as there is no data.student file. Skipping ...")
                counter['backup-devices'] += 1

                continue

            # else: the device secret is known to the room secret mapping
            logging.info(f"Device secret {device_secret} corresponds to room secret object {room_secret_obj}")

            if not importable_upload.has_room_secret() or importable_upload.read_room_secret() != str(room_secret_obj):
                raise Exception(f"The uploaded roomsecret ({importable_upload.read_room_secret() if importable_upload.has_room_secret() else "*no such file found*"}) for the device secret '{device_secret}' does not match the expected roomsecret {room_secret_obj} for upload {importable_upload}")

            registration_details = registrations.get(room_secret_obj.seat_number)
            if registration_details is None:
                # it could be an additional device
                if importable_upload.has_student_data() or importable_upload.has_actual_submissions() or not self._room_secret_obj_matches_pattern_for_additional_device(room_secret_obj):
                    raise Exception("No registration details for seat number despite the device was used (data.student file exists or there are actual submissions or the name in the room.secret file does not match the expected pattern for an additional device)", room_secret_obj, importable_upload)
                else:
                    logging.info(f"Found an additional device with room.secret {room_secret_obj} (name in room secret matches pattern; no data.student file; no actual submission files); skipping ...")
                    counter['additional-devices'] += 1
                    continue
            # from here onward, we have access to a non-none registration

            # if it is an additional device (roomsecretstring matches pattern) AND there is a registration (i.e., there is an entry for this seat number) then we do not expect the roomsecretstring to match the registration details (because it is impossible)
            if self._room_secret_obj_matches_pattern_for_additional_device(room_secret_obj):
                logging.info("The additional device was used by an spontaneous (non-registered) examinee (room.secret and data.student file will contain the additional device pattern, NOT the examinee's name)")
                counter['spontaneous-examinees'] += 1
            elif not self._room_secret_obj_matches_registration_details(room_secret_obj, registration_details):
                # for all other examinees (registered and present) we expect the room.secret file's content to match the registrations details
                raise Exception("Room secret object does not match registration details")

            personal_data = registration_details
            # note: device id is personal data as a supervisor and other examinee may know it as they were present during the exam and the number is publicly visible

            logging.info(f"Upload (device secret: {device_secret}) corresponds to registration {personal_data}")

            if not importable_upload.has_student_data():
                # someone should have been on this device, but no one was => no show
                if importable_upload.has_actual_submissions():
                    raise Exception("There are submissions in an upload without a student data file", importable_upload)
                examinee_was_present = False
                logging.info(f"Examinee {personal_data['last_name']}, {personal_data['first_name']} ({personal_data['student_id']}) is a no-show")
                counter['no-shows'] += 1
            else:
                # someone should have been on this device AND was on this device => show
                examinee_was_present = True
                logging.info(f"Examinee {personal_data['last_name']}, {personal_data['first_name']} ({personal_data['student_id']}) is a show (was present)")
                counter['shows'] += 1
                if not self._room_secret_obj_matches_student_data_file(room_secret_obj, importable_upload.read_student_data()):
                    raise Exception("Room secret object does not match data.student content")

            # code below handles no-shows as well as shows

            examinee_directory, anonymized_first_name, anonymized_last_name = self._create_new_anonymizes_examinee_directory(examinees_directory)
            examinee = Examinee(anonymized_first_name, anonymized_last_name, examinee_directory)
            encrypted_examinee_files = EncryptedExamineeFileStore(examinee_directory, self.padding_target)

            anonymized_student_data = {
                "first_name": anonymized_first_name,
                "last_name": anonymized_last_name
            }

            logging.info(f"Assigning anonymized name {anonymized_first_name} {anonymized_last_name}")

            examinee_directory.mkdir()
            # store the anonymized student data
            with open(examinee_directory.joinpath('anonymized-data.student'), 'w') as f:
                # the anonymized name of the student can be stored unencrypted as it is part of the directory name anyway
                json.dump(anonymized_student_data, f)

            # store the personal data
            encrypted_personal_data_file = encrypted_examinee_files.store_examinee_file("personal-data.enc", json.dumps(personal_data))
            self.submission_signer.sign_base64_file(encrypted_personal_data_file, prefix_bytes=examinee.get_file_signature_prefix(exam_name, encrypted_personal_data_file.name))

            # check whether no grading is chosen
            is_no_grading_chosen = importable_upload.chose_no_grading()

            # create the auxiliary keys for the reassessment file
            encrypted_examinee_files.store_reassessment_result_file(self.grading_signer.get_public_key_hex())

            # create the data needed for the post-exam review (all users get this including no-shows; we will handle that in the UI)
            examinee_exam_user_uuid = self._generate_random_uuid()
            asym_encryptor = AsymmetricEncryptor()
            post_exam_review_users[examinee_directory.name] = (examinee_exam_user_uuid, asym_encryptor)
            encrypted_examinee_files.store_examinee_file('post-exam-review-credentials.enc', json.dumps({"uuid": examinee_exam_user_uuid, "key": asym_encryptor.get_private_key_hex()}))

            # We now have to import the uploaded submission files

            # ... 1) we handle the auxiliary files

            # ... handle exam.handin
            exam_handin_file_content = importable_upload.get_submission_file_content("exam.handin")
            if examinee_was_present and (exam_handin_file_content is None or len(exam_handin_file_content) == 0):
                raise Exception(f"The mandatory auxiliary file exam.handin in upload '{importable_upload}' does not exist or is empty (but must be non-empty for a present examinee)")
            exam_handin_submission_file_path = encrypted_examinee_files.store_submission("exam.handin", exam_handin_file_content)
            logging.debug(f"Storing submission file exam.handin (actual value: {exam_handin_file_content}) in encrypted file {exam_handin_submission_file_path.name}")
            self.submission_signer.sign_base64_file(exam_handin_submission_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, exam_handin_submission_file_path.name))

            # ... handle data.student (may contain student name => must be cleaned)
            data_student_file_content = importable_upload.get_submission_file_content("data.student")
            if examinee_was_present and (data_student_file_content is None or len(data_student_file_content) == 0):
                raise Exception(f"The mandatory auxiliary file data.student in upload '{importable_upload}' does not exist or is empty (but must be non-empty for a present examinee)")
            data_student_file_content = str(examinee_was_present) # remove potential names
            data_student_submission_file_path = encrypted_examinee_files.store_submission("data.student", data_student_file_content)
            logging.debug(f"Storing submission file data.student (actual content: {data_student_file_content}) in encrypted file {data_student_submission_file_path.name}")
            self.submission_signer.sign_base64_file(data_student_submission_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, data_student_submission_file_path.name))

            # ... 2) we handle the task-based submission files
            iterable = ((task, subtask, field) for task in tasks_json.tasks for subtask in task.subtasks for field in subtask.fields)
            for task, subtask, field in iterable:
                answer_file_name = field.get_answer_file_name()
                answer_file_content = importable_upload.get_submission_file_content(answer_file_name)

                encrypted_submission_file_path = encrypted_examinee_files.store_submission(answer_file_name, answer_file_content)
                self.submission_signer.sign_base64_file(encrypted_submission_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, encrypted_submission_file_path.name))
                logging.debug(f"Storing submission file {answer_file_name} (actual length: {"-" if answer_file_content is None else len(answer_file_content)}) in encrypted file {encrypted_submission_file_path.name}")

                if answer_file_content is None or len(answer_file_content) == 0:
                    grading_points_file_path = encrypted_examinee_files.store_grading_points(f"{field.identifier}.points",points=0, comment="∀", annotation=None, grading_type=GradingType.AUTOMATIC_GRADING.value)
                    self.grading_signer.sign_base64_file(grading_points_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, grading_points_file_path.name))
                    logging.debug(f"Subtask field answer for field {field.identifier} was empty; creating grading points file with 0 points")
                elif is_no_grading_chosen is True:
                    # when no grading is chosen, prefill with 0 points and corresponding comment
                    grading_points_file_path = encrypted_examinee_files.store_grading_points(f"{field.identifier}.points", points=0, comment="Examinee chose no grading during submission", annotation=None, grading_type=GradingType.AUTOMATIC_GRADING.value)
                    self.grading_signer.sign_base64_file(grading_points_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, grading_points_file_path.name))
                    logging.debug(f"Subtask field submission for field {field.identifier} is *not* empty but examinee chose no grading; creating grading points file with 0 points")
                else:
                    # when grading is chosen, prefill with placeholder (none) points, etc.
                    grading_points_file_path = encrypted_examinee_files.store_grading_points(f"{field.identifier}.points", points=None, comment=None, annotation=None, grading_type=None)
                    self.grading_signer.sign_base64_file(grading_points_file_path, prefix_bytes=examinee.get_file_signature_prefix(exam_name, grading_points_file_path.name))
                    logging.debug(f"Subtask field submission for field {field.identifier} is *not* empty; creating grading points file with placeholder content (all values null)")

            # make sure the directory for the encrypted gradings exists
            encrypted_examinee_files.mkdir_grading_points_dir()

            # make sure the directory for the encrypted submissions exists
            encrypted_examinee_files.mkdir_submissions_dir()

            # store the file mapping for the current examinee
            encrypted_file_mapping = encrypted_examinee_files.store_file_mapping()
            self.submission_signer.sign_base64_file(encrypted_file_mapping, prefix_bytes=examinee.get_file_signature_prefix(exam_name, encrypted_file_mapping.name))

            # create the "post-exam-accessed" file
            examinee.set_post_exam_review_accessed(False)

            # add the key collection of this examinee to the global key collection of the exam owner
            self.encrypted_file_stores[examinee_directory.name] = encrypted_examinee_files

        self._create_exam_users_for_post_exam_review(post_exam_review_users)

        if len(room_secret_mappings) != counter['shows'] + counter['no-shows'] + counter['additional-devices']:
            raise Exception(f"Number of found room secret mappings ({len(room_secret_mappings)}) does not match the number of {counter['shows'] + counter['no-shows'] + counter['additional-devices']} ({counter})")
        if found_device_secrets != set(room_secret_mappings.keys()):
            raise Exception(f"Not all device secrets from the room secret mapping were found in the imported uploads. Difference mapping-found: {set(room_secret_mappings.keys()).difference(found_device_secrets)}, found-mapping: {set(found_device_secrets).difference(room_secret_mappings.keys())}")

        logging.info(f"Imported uploads (in total: {len(importable_uploads)}) with shows: {counter['shows']} ({counter['spontaneous-examinees']} spontaneous, non-registered examinees), no-shows: {counter['no-shows']}, additional devices: {counter['additional-devices']}, backup devices: {counter['backup-devices']}")

    def _create_new_anonymizes_examinee_directory(self, examinees_directory):
        while True:
            random_name = RandomNameGenerator.generate_examinee_name()
            random_file_name = f"{random_name[0]}-{random_name[1]}".lower()
            examinee_directory = examinees_directory.joinpath(random_file_name)
            if not examinee_directory.exists():
                return examinee_directory, random_name[0], random_name[1]

    def _room_secret_obj_matches_pattern_for_additional_device(self, room_secret_obj):
        return 0 <= (int(room_secret_obj.student_id, 10) % 99999) <= 5 and room_secret_obj.last_name == 'NotRegistered'

    def _room_secret_obj_matches_registration_details(self, room_secret_obj, registration_details):
        if room_secret_obj.student_id != registration_details['student_id']:
            raise Exception("Student ID in room secret does not match the student ID in the registrations", room_secret_obj, registration_details)

        replacements_characters = {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss', 'ẞ': 'Ss', ' ': '', '-': ''
        }
        ascii_last_name = unidecode(registration_details['last_name'].translate({ord(k): v for k, v in replacements_characters.items()}))
        ascii_first_name = unidecode(registration_details['first_name'].translate({ord(k): v for k, v in replacements_characters.items()}))

        if room_secret_obj.last_name != ascii_last_name:
            raise Exception("Last name in room secret mapping object does not match expected last name for the given participant at given seat number", room_secret_obj, registration_details)
        if room_secret_obj.first_name not in ascii_first_name:
            raise Exception("First name in room secret mapping file is not contained in expected first name for the given participant at given seat number", room_secret_obj, registration_details)

        logging.debug(f'Accepting room secret {room_secret_obj} for {registration_details} (name in ascii: {ascii_last_name}, {ascii_first_name})')

        return True

    def _room_secret_obj_matches_student_data_file(self, room_secret_obj, student_data):
        if room_secret_obj.student_id != student_data['student_id']:
            raise Exception("Student ID of room secret string does not match student ID in the data.student file", room_secret_obj, student_data)
        if room_secret_obj.last_name != student_data['lastname']:
            raise Exception("Last name of room secret string does not match last name in the data.student file", room_secret_obj, student_data)
        if room_secret_obj.first_name != student_data['firstname']:
            raise Exception("First name of room secret string does not match first name in the data.student file", room_secret_obj, student_data)

        logging.debug("Accepting room secret for data.student file")

        return True

    def _check_directories(self):
        if not self.importable_exam.source_exam_directory.is_dir():
            raise Exception("Source exam directory does not exist", self.importable_exam.source_exam_directory)
        if not self.importable_exam.get_exam_template_directory().is_dir():
            raise Exception("Template exam directory does not exist", self.importable_exam.get_exam_template_directory())
        if self.target_exam_directory.is_dir():
            raise Exception("Target exam directory already exists", self.target_exam_directory)
        if not self.local_keys_directory.is_dir():
            raise Exception("Local keys directory does not exist", self.local_keys_directory)

    def _create_directories(self):
        self.target_exam_directory.mkdir()
        self.target_exam_directory.joinpath('users').mkdir()
        self.target_exam_directory.joinpath('examinees').mkdir()

    def _export_owner_files(self):
        # write the importers key file to the users directory
        owner_master_asym_encryptor = AsymmetricEncryptor()

        uuid = self._generate_random_uuid()

        owner_permissions = self._get_predefined_service_provider_permissions()

        owner_pseudonym = RandomNameGenerator.generate_grader_pseudonym()

        print()
        owner_real_name = input(">> Please provide the real name of the first user to invite: ")

        logging.info(f"Assigning uuid {uuid} to the owner with pseudonym {owner_pseudonym}")
        owner_key_collection = {examinee: key_collection_of_examinee.export_all_keys() for examinee, key_collection_of_examinee in self.encrypted_file_stores.items()}
        owner_key_collection['exam'] = {
            'auxiliary-keys': {k: v.get_secret_key_hex() for k, v in self.exam_auxiliary_encryptor.items()},
            'file-keys': dict()
        }

        self._write_exam_user_files(owner_key_collection, owner_master_asym_encryptor, uuid, owner_pseudonym, owner_permissions, real_name=owner_real_name, public_signing_key_hex=None)

        print("=> OWNER MASTER ENCRYPTION PRIVATE KEY (hex):", owner_master_asym_encryptor.get_private_key_hex())

        _url_path = f"/grading/invite?exam={self.target_exam_directory.name}&uuid={uuid}#{owner_master_asym_encryptor.get_private_key_hex()}"
        _local_url = f"http://127.0.0.1:5300{_url_path}"

        print("INVITE LOCAL URL:", _local_url)

    def _create_exam_auxiliary_keys(self):
        self.exam_auxiliary_encryptor['other-grader-personal-data'] = SymmetricEncryptor()

    def _export_importer_files(self):
        # write the importers key file to the users directory
        importer_master_asym_encryptor = AsymmetricEncryptor()

        uuid = self._generate_random_uuid()

        importer_permissions = self._get_predefined_service_provider_permissions()
        importer_permissions.append("manage-graders:non-deletable")

        importer_name = "e-exam system"
        logging.info(f"Assigning uuid {uuid} to the importer with name {importer_name}")
        importer_key_collection = {examinee: key_collection_of_examinee.export_all_keys() for examinee, key_collection_of_examinee in self.encrypted_file_stores.items()}
        importer_key_collection['exam'] = {
            'auxiliary-keys': { k: v.get_secret_key_hex() for k, v in self.exam_auxiliary_encryptor.items() },
            'file-keys': dict()
        }
        self._write_exam_user_files(importer_key_collection, importer_master_asym_encryptor, uuid, importer_name, importer_permissions, real_name=importer_name, public_signing_key_hex=self.grading_signer.get_public_key_hex())

        print("=> IMPORTER ENCRYPTION PRIVATE KEY (hex):", importer_master_asym_encryptor.get_private_key_hex(), "-- PRIVATE SIGNING KEY (hex):", self.grading_signer.get_private_key_hex())
        _url_path = f"/grading/welcome?exam={self.target_exam_directory.name}&uuid={uuid}#{importer_master_asym_encryptor.get_private_key_hex()}_{self.grading_signer.get_private_key_hex()}"
        _local_url = f"http://127.0.0.1:5300{_url_path}"

        print("IMPORTER LOCAL URL:", _local_url)

        logging.info(f"Attempting to export importer keys to local key file: {self._get_local_keys_file()}")
        with open(self._get_local_keys_file(), "w") as f:
            json.dump({
                "importer-uuid": uuid,
                "master-encryption-private-key-hex": importer_master_asym_encryptor.get_private_key_hex(),
                "master-encryption-public-key-hex": importer_master_asym_encryptor.get_public_key_hex(),
                "private-signing-key-hex": self.grading_signer.get_private_key_hex(),
                "public-signing-key-hex": self.grading_signer.get_public_key_hex(),
                "local-welcome-url": _local_url,
            }, f, indent=2, sort_keys=True)

    def _generate_random_uuid(self):
        return secrets.token_hex(32)

    def _write_exam_user_files(self, key_collection, asymmetric_encryptor, uuid, pseudonym, raw_permissions_list, real_name=None, public_signing_key_hex=None):
        exam = Exam.get(self.target_exam_directory.name)

        _log_general_exam_keys_count = sum(len(keys_of_type) for key_type, keys_of_type in key_collection.get('exam', dict()).items())
        _log_examinee_keys_count = len(key_collection)-1 if 'exam' in key_collection else len(key_collection)
        _total_aux_keys = sum(len(key_group['auxiliary-keys']) for key_group in key_collection.values())
        _total_file_keys = sum(len(key_group['file-keys']) for key_group in key_collection.values())

        logging.info(f"Encrypting and storing a total of {_total_file_keys} file keys and {_total_aux_keys} auxiliary keys for {_log_examinee_keys_count} unique examinees (including {_log_general_exam_keys_count} general exam keys) in key collection for pseudonym {pseudonym} (uuid: {uuid})")

        message = json.dumps(key_collection)
        encrypted_keys = asymmetric_encryptor.encrypt(message)

        encrypted_name_self, encrypted_name_others = None, None
        if real_name is not None:
            # encrypt your name for yourself (will only trigger for graders)
            encrypted_name_self = asymmetric_encryptor.encrypt(real_name)
            encrypted_name_others = self.exam_auxiliary_encryptor['other-grader-personal-data'].encrypt(real_name)

        exam_user = ExamUser(exam, uuid, pseudonym, encrypted_keys, asymmetric_encryptor.get_public_key_hex(), raw_permissions_list, True,
                             encrypted_name_self=encrypted_name_self,
                             encrypted_name_others=encrypted_name_others,
                             public_signing_key_hex=public_signing_key_hex)
        exam_user.save()

    def _create_exam_users_for_post_exam_review(self, post_exam_review_users):
        exam = Exam.get(self.target_exam_directory.name)
        examinees = exam.get_examinees()

        for examinee_identifier, examinee in examinees.items():
            examinee_exam_user_uuid, examinee_asym_encryptor = post_exam_review_users.get(examinee_identifier)
            post_exam_review_needed_permissions = [
                "download-exam-data:valid-public-keys", "download-exam-data:task-data", "download-exam-data:grade-calculation",
                "access-ui:post-exam-review-invitation", "access-ui:post-exam-review-perform",
                f"post-exam-review:{examinee_identifier}",
                f"download-examinee-data:anonymized-data:{examinee_identifier}", f"download-examinee-data:file-mapping:{examinee_identifier}", f"download-examinee-data:personal-data:{examinee_identifier}",
                f"download-examinee-data:reassessment-result:{examinee_identifier}",
                f"download-submission:{examinee_identifier}:*",
                f"download-grading-points:{examinee_identifier}:*"
            ]

            allowed_examinee_keys = self.encrypted_file_stores[examinee_identifier].export_keys_for_post_exam_review()

            key_collection = {
                examinee_identifier: allowed_examinee_keys
            }

            self._write_exam_user_files(key_collection, examinee_asym_encryptor, examinee_exam_user_uuid, examinee_identifier, post_exam_review_needed_permissions, None)


    def _export_general_exam_files(self):
        grade_limits = self.importable_exam.get_default_grade_limits()
        if type(grade_limits) is not list:
            raise Exception("Invalid grade-limits in exam-grading.json")

        passed_limit = None
        for grade, limit in grade_limits:
            if grade == '4.0':
                passed_limit = limit
                break

        grade_calculation = {
            "passed-limit": passed_limit,
            "grade-limits": grade_limits
        }

        exam = Exam.get(self.target_exam_directory.name)
        exam.save_grade_calculation(grade_calculation)
        exam.save_exam_phase('grading')
        # allow exam review per default "yesterday" till "yesterday" so there is no issue with this by accidentally changing to review phase
        yesterday = datetime.date.today() - datetime.timedelta(days=1)
        exam.save_review_config(yesterday, yesterday)

    def _copy_exam_template_files(self):
        logging.debug("Copying exam-files from importable exams to target exam ...")
        shutil.copytree(self.importable_exam.get_exam_template_directory(), self.target_exam_directory.joinpath('exam-files'))

    def _get_local_keys_file(self):
        return self.local_keys_directory.joinpath(f"keys-{self.target_exam_directory.name}.json")

    def _check_local_keys_file(self):
        if self._get_local_keys_file().exists():
            raise Exception("Local keys file already exists, aborting import")

    def _get_predefined_service_provider_permissions(self):
        _set = {"access-ui:exam-overview", "access-ui:graders", "access-ui:statistics", "access-ui:points-and-grades",
                "download-exam-data:exam-phase", "download-exam-data:valid-public-keys",
                "download-exam-data:exam-graders", "download-exam-data:exam-graders-personal-data",
                "access-ui:individual-grading", "access-ui:group-grading",
                "access-ui:lifecycle", "manage-lifecycle:change-phase", "download-examinee-data:reassessment-result:*",
                "upload-reassessment-result:*", "download-grading-points:*:*", "download-examinee-data:file-mapping:*",
                "download-examinee-data:post-exam-review-credentials:*", "download-examinee-data:post-exam-review-accessed:*",
                "download-examinee-data:anonymized-data:*", "download-exam-data:task-data", "download-exam-data:post-exam-review-timeframe",
                "download-exam-data:grade-calculation", "update-exam-data:post-exam-review-timeframe", "update-exam-data:grade-calculation", "download-submission:*:*",
                "upload-grading-points:*:*",
                "download-examinee-data:personal-data:*", "manage-graders:add-grader", "manage-graders:delete-grader",
                "access-ui:manage-post-exam-review", "access-ui:post-exam-review-invitation", "access-ui:post-exam-review-perform", "post-exam-review:*"}
        return list(_set)
