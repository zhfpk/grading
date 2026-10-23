import json
import pathlib
import re
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Optional


class SubmissionType(Enum):
    TASK_ANSWER = 'answer'
    EXAM_HANDIN = 'handin'


@dataclass
class ExamJSONFile:
    exam_template_directory: pathlib.Path
    name: str
    shortname: str
    date: str
    forced_language: Optional[str] = None

    file_name = "exam.json"

    def __post_init__(self):
        if self.shortname is None:
            raise Exception("Exam: Shortname is invalid (none)")
        if self.name is None or len(self.name) == 0:
            raise Exception("Exam: Name is invalid (none or empty)")
        if self.date is None or len(self.date) == 0:
            raise Exception("Exam: Date is invalid (none or empty)")

    def is_language_forced(self):
        return self.forced_language is not None

    @classmethod
    def load_file(cls, exam_template_directory):
        with open(cls.get_file_path(exam_template_directory), "r", encoding="utf8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            raise ValueError(f"Invalid {ExamJSONFile.file_name} file format: Root object must be dict")

        required = {"name", "shortname", "date"}
        allowed = required.union({"forced_language"})

        if any((key not in allowed) for key in data.keys()):
            raise ValueError(f"Invalid {ExamJSONFile.file_name} file format: Invalid attribute found")

        return cls(exam_template_directory, **data)

    @staticmethod
    def get_file_path(exam_template_directory):
        return exam_template_directory.joinpath(ExamJSONFile.file_name)


@dataclass
class TasksJSONField:
    identifier: str
    field_type: str

    field_identifier_pattern = r'^[A-Z0-9a-z\_]+$'  # no '-' in identifier names
    valid_field_types = {'text', 'tex'}

    def __post_init__(self):
        if not re.match(self.field_identifier_pattern, self.identifier):
            raise ValueError(f"Invalid field identifier '{self.identifier}'. Please stick to regex pattern: {self.field_identifier_pattern}.")

        if self.field_type not in self.valid_field_types:
            raise ValueError(f"Invalid field type '{self.field_type}' for identifier '{self.identifier}'. Allowed types are { ', '.join(self.valid_field_types) }.")

    def get_answer_file_name(self):
        return f"{self.identifier}.{SubmissionType.TASK_ANSWER.value}"

    @classmethod
    def from_json(cls, data):
        required = {'identifier', 'field_type'}

        if not isinstance(data, dict):
            raise ValueError(f"Invalid {TasksJSONFile.file_name} file format: A subtask field entry must be of type dict")

        if len(data) != len(required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: Only the attributes {', '.join(required)} are allowed")

        if any((attr not in data or data[attr] is None or len(data[attr]) == 0) for attr in required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: The attributes {', '.join(required)} need a non-empty value")

        return cls(**data)


@dataclass
class TasksJSONSubtask:
    name: str
    points: int
    fields: list[TasksJSONField]

    def __post_init__(self):
        if type(self.name) is not str or len(self.name) == 0:
            raise ValueError("The name of a subtask must be a non-empty string")
        if " " in self.name:
            raise ValueError("The name of a subtask cannot contain a space")
        if type(self.points) is not int or self.points <= 0:
            raise ValueError("The points of a subtask must be a non-negative integer")

        if isinstance(self.fields, list):
            known_field_names = set()
            for field in self.fields:
                if field.identifier in known_field_names:
                    raise ValueError(f"The subtask contains a duplicate subtask field with the identifier '{field.identifier}'. Please make sure that field identifiers are unique per exam.")
                known_field_names.add(field.identifier)

    def get_field_identifiers(self):
        return [field.identifier for field in self.fields]

    def get_valid_answer_files(self):
        return [field.get_answer_file_name() for field in self.fields]

    @classmethod
    def from_json(cls, data):
        required = {'name', 'points', 'fields'}

        if not isinstance(data, dict):
            raise ValueError(f"Invalid {TasksJSONFile.file_name} file format: A subtask entry must be of type dict")

        if len(data) != len(required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: Only the attributes {', '.join(required)} are allowed")

        if any((attr not in data or data[attr] is None) for attr in required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: The attributes {', '.join(required)} need a non-empty value")

        if not isinstance(data['fields'], list):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: The attribute fields must be of type list")

        fields = list()
        for field_entry in data.get("fields", []):
            field = TasksJSONField.from_json(field_entry)
            fields.append(field)

        return cls(data['name'], data['points'], fields)


@dataclass
class TasksJSONTask:
    name: str
    subtasks: list[TasksJSONSubtask]

    def __post_init__(self):
        if type(self.name) is not str or len(self.name) == 0:
            raise ValueError("The name of a task must be a non-empty string")
        if len(self.subtasks) == 0:
            raise ValueError(f"The task {self.name} has no subtasks")
        taken_subtask_names = set()
        for subtask in self.subtasks:
            if subtask.name in taken_subtask_names:
                raise ValueError(f'Duplicated subtask identifier {subtask.name} in task {self.name}. Subtask identifier have to be unique!')
            taken_subtask_names.add(subtask.name)

    def get_valid_answer_files(self):
        return [answer_file for subtask in self.subtasks for answer_file in subtask.get_valid_answer_files()]

    def get_subtask_names(self):
        return [s.name for s in self.subtasks]

    def get_subtask_field_identifiers(self):
        return [field for subtask in self.subtasks for field in subtask.get_field_identifiers()]

    def calculate_task_point_sum(self):
        return sum(subtask.points for subtask in self.subtasks)

    @classmethod
    def from_json(cls, data):
        required = {'name', 'subtasks'}

        if not isinstance(data, dict):
            raise ValueError(f"Invalid {TasksJSONFile.file_name} file format: A task entry must be of type dict")

        if len(data) != len(required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: Only the attributes {', '.join(required)} are allowed")

        if any((attr not in data or data[attr] is None or len(data[attr]) == 0) for attr in required):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: The attributes {', '.join(required) } need a non-empty value")

        if not isinstance(data['subtasks'], list):
            raise ValueError(f"Invalid {TasksJSONFile.file_name}: The attribute subtasks must be of type list")

        subtasks = []
        for subtask_entry in data.get("subtasks", []):
            subtask = TasksJSONSubtask.from_json(subtask_entry)
            subtasks.append(subtask)

        return cls(data['name'], subtasks)


@dataclass
class TasksJSONFile:
    exam_template_directory: pathlib.Path
    tasks: list[TasksJSONTask]

    file_name = "tasks.json"

    def __post_init__(self):
        taken_task_names = set()
        taken_subtask_names = set()
        taken_subtask_field_identifiers = set()
        for task in self.tasks:
            if task.name in taken_task_names:
                raise ValueError(f"The task named {task.name} already exists (there is a duplicate task with the same name).")
            if any(subtask_name in taken_subtask_names for subtask_name in task.get_subtask_names()):
                raise ValueError(f"The names of subtask must be unique across all tasks, however, there are duplicates.")
            if any(subtask_field_identifier in taken_subtask_field_identifiers for subtask_field_identifier in task.get_subtask_field_identifiers()):
                raise ValueError(f"The names of subtask fields must be unique across all tasks, however, there are duplicates.")
            taken_task_names.add(task.name)
            taken_subtask_names.update(task.get_subtask_names())
            taken_subtask_field_identifiers.update(task.get_subtask_field_identifiers())

    def get_valid_answer_files(self):
        return [answer_file for task in self.tasks for answer_file in task.get_valid_answer_files()]

    def calculate_exam_point_sum(self):
        return sum(task.calculate_task_point_sum() for task in self.tasks)

    def calculate_task_point_sum(self, task_name):
        for task in self.tasks:
            if task.name == task_name:
                return task.calculate_task_point_sum()
        raise ValueError(f"The task {task_name} does not exist")

    def write_to_file(self):
        _dict = {
            '__comment': "WARNING: This file is automatically generated when development mode is active. Do *NOT* modify this file unless you know what you are doing!",
            'tasks': [asdict(task) for task in self.tasks]
        }
        with open(self.get_file_path(self.exam_template_directory), "w", encoding="utf-8") as f:
            json.dump(_dict, f, indent=2, sort_keys=False)

    @classmethod
    def load_file(cls, exam_template_directory):
        with open(cls.get_file_path(exam_template_directory), "r", encoding="utf8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            raise ValueError(f"Invalid {TasksJSONFile.file_name} file format: Root object must be dict")

        if not isinstance(data.get('tasks', []), list):
            raise ValueError(f"Invalid {TasksJSONFile.file_name} file format: The attribute tasks must be a list")

        tasks = []
        for task_entry in data.get('tasks', []):
            tasks.append(TasksJSONTask.from_json(task_entry))

        return cls(exam_template_directory, tasks)

    @staticmethod
    def get_file_path(exam_template_directory):
        return exam_template_directory.joinpath(TasksJSONFile.file_name)

