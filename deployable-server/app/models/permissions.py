import re
from abc import ABC, abstractmethod


class Permission(ABC):
    REGEX_PATTERN: re.Pattern = None

    def __init__(self, raw: str):
        if not self.is_valid(raw):
            raise ValueError(f"Invalid permission syntax: {raw}")
        self.raw = raw

    def __str__(self):
        return self.raw

    @classmethod
    def is_valid(cls, raw: str) -> bool:
        if cls.REGEX_PATTERN is None:
            raise NotImplementedError("REGEX_PATTERN must be defined in subclass.")
        if not cls.REGEX_PATTERN.fullmatch(raw):
            return False
        return cls._check_tokens(raw)

    @staticmethod
    def _check_tokens(raw: str) -> bool:
        parts = raw.split(":")[1:]  # skip the static prefix
        return all(token == "*" or re.fullmatch(r"[a-z0-9-.]+", token) for token in parts)

    @abstractmethod
    def matches(self, other) -> bool:
        ...


class PermissionFactory:
    _registry = []

    @classmethod
    def register(cls, permission_cls):
        cls._registry.append(permission_cls)
        return permission_cls

    @classmethod
    def from_string(cls, raw: str) -> Permission:
        for perm_cls in cls._registry:
            if perm_cls.is_valid(raw):
                return perm_cls(raw)
        raise ValueError(f"No matching permission class found for: {raw}")


@PermissionFactory.register
class DownloadExamDataPermission(Permission):
    REGEX_PATTERN = re.compile(r"^download-exam-data:(task-data|exam-phase|grade-calculation|exam-graders|exam-graders-personal-data|valid-public-keys|post-exam-review-timeframe)$")

    @classmethod
    def create(cls, section: str):
        return cls(f"download-exam-data:{section}")

    def matches(self, other: Permission) -> bool:
        return isinstance(other, DownloadExamDataPermission) and self.raw == other.raw


@PermissionFactory.register
class UpdateExamDataPermission(Permission):
    REGEX_PATTERN = re.compile(r"^update-exam-data:(grade-calculation|post-exam-review-timeframe)$")

    @classmethod
    def create(cls, section: str):
        return cls(f"update-exam-data:{section}")

    def matches(self, other: Permission) -> bool:
        return isinstance(other, UpdateExamDataPermission) and self.raw == other.raw


@PermissionFactory.register
class AccessUiPermission(Permission):
    REGEX_PATTERN = re.compile(r"^access-ui:(statistics|exam-overview|individual-grading|group-grading|graders|points-and-grades|lifecycle|post-exam-review-invitation|post-exam-review-perform|manage-post-exam-review)$")

    @classmethod
    def create(cls, section: str):
        return cls(f"access-ui:{section}")

    def matches(self, other: Permission) -> bool:
        return isinstance(other, AccessUiPermission) and self.raw == other.raw


@PermissionFactory.register
class ManageLifecyclePermission(Permission):
    REGEX_PATTERN = re.compile(r"^manage-lifecycle:(change-phase)$")

    @classmethod
    def create(cls, section: str):
        return cls(f"manage-lifecycle:{section}")

    def matches(self, other: Permission) -> bool:
        return isinstance(other, ManageLifecyclePermission) and self.raw == other.raw


@PermissionFactory.register
class PostExamReviewPermission(Permission):
    REGEX_PATTERN = re.compile(r"^post-exam-review:([a-z-]+|\*)$")

    @classmethod
    def create(cls, examinee_id: str):
        return cls(f"post-exam-review:{examinee_id}")

    def __init__(self, raw: str):
        super().__init__(raw)
        _, self.examinee_id = self.raw.split(':')

    def matches(self, other: Permission) -> bool:
        return (
            isinstance(other, PostExamReviewPermission)
            and (self.examinee_id == '*' or self.examinee_id == other.examinee_id)
        )


@PermissionFactory.register
class ManageGradersPermission(Permission):
    REGEX_PATTERN = re.compile(r"^manage-graders:(delete-grader|add-grader|non-deletable)$")

    @classmethod
    def create(cls, action: str):
        return cls(f"manage-graders:{action}")

    def matches(self, other: Permission) -> bool:
        return isinstance(other, ManageGradersPermission) and self.raw == other.raw


@PermissionFactory.register
class DownloadExamineeDataPermission(Permission):
    REGEX_PATTERN = re.compile(r"^download-examinee-data:(anonymized-data|file-mapping|personal-data|reassessment-result|post-exam-review-credentials|post-exam-review-accessed):([a-z-]+|\*)$")

    @classmethod
    def create(cls, data_type: str, examinee_id: str):
        return cls(f"download-examinee-data:{data_type}:{examinee_id}")

    def __init__(self, raw: str):
        super().__init__(raw)
        _, self.data_type, self.examinee_id = self.raw.split(':')

    def matches(self, other: Permission) -> bool:
        return (
            isinstance(other, DownloadExamineeDataPermission)
            and self.data_type == other.data_type
            and (self.examinee_id == '*' or self.examinee_id == other.examinee_id)
        )


@PermissionFactory.register
class UploadReassessmentResultPermission(Permission):
    REGEX_PATTERN = re.compile(r"^upload-reassessment-result:([a-z-]+|\*)$")

    @classmethod
    def create(cls, examinee_id: str):
        return cls(f"upload-reassessment-result:{examinee_id}")

    def __init__(self, raw: str):
        super().__init__(raw)
        _, self.examinee_id = self.raw.split(':')

    def matches(self, other: Permission) -> bool:
        return (
                isinstance(other, UploadReassessmentResultPermission)
                and (self.examinee_id == '*' or self.examinee_id == other.examinee_id)
        )


@PermissionFactory.register
class DownloadSubmissionPermission(Permission):
    REGEX_PATTERN = re.compile(r"^download-submission:([a-z-]+|\*):([a-z0-9-.]+|\*)$")

    @classmethod
    def create(cls, examinee_id: str, file_id: str):
        return cls(f"download-submission:{examinee_id}:{file_id}")

    def __init__(self, raw: str):
        super().__init__(raw)
        _, self.examinee_id, self.file_id = self.raw.split(':')

    def matches(self, other: Permission) -> bool:
        return (
            isinstance(other, DownloadSubmissionPermission)
            and (self.examinee_id == '*' or self.examinee_id == other.examinee_id)
            and (self.file_id == '*' or self.file_id == other.file_id)
        )


class GradingPointsPermission(Permission):
    def __init__(self, raw: str):
        super().__init__(raw)
        parts = self.raw.split(':')
        self.examinee_id = parts[1]
        self.file_id = parts[2]

    def matches(self, other: Permission) -> bool:
        return (
            isinstance(other, self.__class__)
            and (self.examinee_id == '*' or self.examinee_id == other.examinee_id)
            and (self.file_id == '*' or self.file_id == other.file_id)
        )


@PermissionFactory.register
class DownloadGradingPointsPermission(GradingPointsPermission):
    REGEX_PATTERN = re.compile(r"^download-grading-points:([a-z-]+|\*):([a-z0-9-.]+|\*)$")

    @classmethod
    def create(cls, examinee_id: str, file_id: str):
        return cls(f"download-grading-points:{examinee_id}:{file_id}")


@PermissionFactory.register
class UploadGradingPointsPermission(GradingPointsPermission):
    REGEX_PATTERN = re.compile(r"^upload-grading-points:([a-z-]+|\*):([a-z0-9-.]+|\*)$")

    @classmethod
    def create(cls, examinee_id: str, file_id: str):
        return cls(f"upload-grading-points:{examinee_id}:{file_id}")


