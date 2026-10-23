import json
import re
import secrets
import time
from binascii import hexlify

from app.models.naclcrypto import SignatureVerifier
from app.models.permissions import PermissionFactory, AccessUiPermission, Permission


class ExamUser:
    def __init__(self, exam, uuid, pseudonym, encrypted_keys, master_encryption_public_key_hex, raw_permissions_list, is_active, encrypted_name_self=None, encrypted_name_others=None, public_signing_key_hex=None):
        if exam is None or uuid is None or pseudonym is None or encrypted_keys is None or raw_permissions_list is None or type(is_active) is not bool:
            raise ValueError("Invalid arguments for ExamUser", uuid)
        self.exam = exam
        self.uuid = uuid
        self.pseudonym = pseudonym
        self.encrypted_keys = encrypted_keys
        self.master_encryption_public_key_hex = master_encryption_public_key_hex
        self.permissions = [PermissionFactory.from_string(rp) for rp in raw_permissions_list]
        self.is_active = is_active
        self.encrypted_name_self = encrypted_name_self
        self.encrypted_name_others = encrypted_name_others
        self.public_signing_key_hex = public_signing_key_hex

    def has_permission(self, required) -> bool:
        if type(required) is str:
            required = PermissionFactory.from_string(required)
        if not isinstance(required, Permission):
            return False

        return any(p.matches(required) for p in self.permissions)

    def stringify_permissions(self):
        return [str(p) for p in self.permissions]

    def has_public_signing_key(self):
        return self.public_signing_key_hex is not None

    def generate_fresh_challenge(self):
        if not self.is_grader():
            raise Exception("Cannot generate challenge for non-grader users")

        if self.has_public_signing_key():
            raise Exception("Cannot generate fresh challenge when there already exists a public signing key")
        random_token = secrets.token_hex(64)
        fresh_challenge = f"CLG_{random_token}_{self.exam.exam_name}_{self.uuid}"
        with open(ExamUser._get_challenge_file_path(self.exam, self.uuid), "w") as f:
            f.write(fresh_challenge)
        return fresh_challenge

    def get_challenge(self):
        challenge_file = ExamUser._get_challenge_file_path(self.exam, self.uuid)
        if not challenge_file.exists():
            return None
        with open(challenge_file, "r") as f:
            return f.read()

    def verify_challenge(self, solved_challenge, public_signing_key_hex=None):
        challenge = self.get_challenge()
        if challenge is None or solved_challenge is None or len(solved_challenge) == 0:
            return False

        # everytime there is a challenge, and it was attempted to be solved, generate a new one
        self.generate_fresh_challenge()
        if public_signing_key_hex is None:
            used_public_key_hex = self.public_signing_key_hex
        else:
            used_public_key_hex = public_signing_key_hex

        verifier = SignatureVerifier(used_public_key_hex)

        return verifier.is_signature_valid(challenge.encode('utf8'), solved_challenge)

    def store_public_signing_key(self, public_signing_key_hex):
        if self.has_public_signing_key():
            raise Exception("Public key already exists")

        if not self.is_grader():
            raise Exception("Cannot store public key for non-grader users")

        # delete the challenge file directly when a valid key is given
        challenge_file = ExamUser._get_challenge_file_path(self.exam, self.uuid)
        challenge_file.unlink()

        self.public_signing_key_hex = public_signing_key_hex

        self.save()

    def is_grader(self):
        return self.has_permission(AccessUiPermission.create('individual-grading')) or self.has_permission(AccessUiPermission.create('group-grading'))

    def delete_user_files(self):
        files_to_delete = [
            ExamUser._get_file_for_user(self.exam, self.uuid),
            ExamUser._get_challenge_file_path(self.exam, self.uuid)
        ]

        for file in files_to_delete:
            if file.is_file():
                file.unlink()

    def get_state(self):
        if not self.is_grader():
            # does not have a single grading permission => examinee
            return "examinee"

        if self.public_signing_key_hex is not None:
            # a public key => active grader
            return "active"
        else:
            # no public key => grader did not accept invitation yet
            return "invited"

    def save(self):
        user_file = ExamUser._get_file_for_user(self.exam, self.uuid)

        with open(user_file, "w") as f:
            json.dump({
                "pseudonym": self.pseudonym,
                "keys": self.encrypted_keys,
                "public_master_encryption_key": self.master_encryption_public_key_hex,
                "permissions": self.stringify_permissions(),
                "active": self.is_active,
                "name_self": self.encrypted_name_self,
                "name_others": self.encrypted_name_others,
                "public_signing_key": self.public_signing_key_hex
            }, f, indent=2)

    @classmethod
    def get(cls, exam, uuid):
        # note: uuid cannot be used for LFI because it must match the uuid pattern
        try:
            user_file = ExamUser._get_file_for_user(exam, uuid)
        except:
            return None

        if not user_file.is_file():
            return None

        user_data = None
        with open(user_file, 'r') as f:
            user_data = json.load(f)

        # verify user data
        if type(user_data) is not dict:
            raise Exception("User data was not a dictionary")

        # verify pseudonym
        _pseudonym = user_data.get('pseudonym', None)
        if type(_pseudonym) is not str or len(_pseudonym.strip()) == 0:
            raise Exception("User data contains an invalid pseudonym")
        _pseudonym = _pseudonym.strip()

        # verify keys
        _keys = user_data.get('keys', None)
        if type(_keys) is not str or len(_keys.strip()) == 0:
            raise Exception("User data contains invalid keys")

        # verify public master encryption key
        _master_encryption_public_key = user_data.get('public_master_encryption_key', None)
        if not ExamUser.is_valid_public_master_encryption_key(_master_encryption_public_key):
            raise Exception("User data contains invalid master encryption encryption key")

        # verify permissions
        _permissions = user_data.get('permissions', None)
        if type(_permissions) is not list:
            raise Exception("User data contains invalid permissions")

        # verify is active
        _is_active = user_data.get('active', False)
        if type(_is_active) is not bool:
            raise Exception("User data contains invalid active value")

        # verify name self
        _encrypted_name_self = user_data.get('name_self', None)
        if _encrypted_name_self is not None and (type(_encrypted_name_self) is not str or len(_encrypted_name_self.strip()) == 0):
            raise Exception("User data contains an invalid encrypted name (for self)")

        # verify name for others
        _encrypted_name_others = user_data.get('name_others', None)
        if _encrypted_name_others is not None and (type(_encrypted_name_others) is not str or len(_encrypted_name_others.strip()) == 0):
            raise Exception("User data contains an invalid encrypted name (for others)")

        # verify public signing key
        _public_signing_key = user_data.get('public_signing_key', None)
        if _public_signing_key is not None and not ExamUser.is_valid_public_signing_key(_public_signing_key):
            raise Exception("User data contains invalid public key")

        return ExamUser(exam, uuid, _pseudonym, _keys, _master_encryption_public_key, _permissions, _is_active,
                        encrypted_name_self=_encrypted_name_self,
                        encrypted_name_others=_encrypted_name_others,
                        public_signing_key_hex=_public_signing_key)

    @staticmethod
    def _get_challenge_file_path(exam, uuid):
        return exam.get_users_directory().joinpath(uuid + '.challenge')

    @staticmethod
    def is_valid_public_master_encryption_key(public_key):
        return type(public_key) is str and re.fullmatch(r'[0-9a-f]{64}', public_key) is not None

    @staticmethod
    def is_valid_public_signing_key(public_key):
        return type(public_key) is str and re.fullmatch(r'[0-9a-f]{64}', public_key) is not None

    @staticmethod
    def is_valid_uuid_format(uuid):
        return uuid is not None and re.fullmatch(r'[a-f0-9]{64}', uuid) is not None

    @staticmethod
    def _get_file_for_user(exam, uuid):
        # note: this prevents LFI
        if not ExamUser.is_valid_uuid_format(uuid):
            raise Exception("Invalid uuid format")
        return exam.get_users_directory().joinpath(f'{uuid}.user')

    @staticmethod
    def list_uuids(exam):
        users_directory = exam.get_users_directory()

        valid_uuids = []
        for user_file in users_directory.glob("*.user"):
            if not user_file.is_file():
                continue
            uuid = user_file.stem
            if ExamUser.is_valid_uuid_format(uuid):
                valid_uuids.append(uuid)
        return valid_uuids

    @staticmethod
    def list_users(exam):
        return [ExamUser.get(exam, uuid) for uuid in ExamUser.list_uuids(exam)]

