from pathlib import Path

from flask import Flask
from jinja2 import BaseLoader, ChoiceLoader, FileSystemLoader, TemplateNotFound

from app.models.exams import Exam
from app.views import base, grading, tasks, admin, review
from app.api import exams as api_exams
from app.api import admin as api_admin


class ExamTemplateLoader(BaseLoader):
    def __init__(self):
        pass

    def get_source(self, environment, template):
        if template.count('/') != 1:
            raise TemplateNotFound(template)

        exam_name, task_template = template.split('/')

        exam = Exam.get(exam_name)
        if exam is None:
            raise TemplateNotFound(template)

        relative_template_path = exam.get_relative_task_template_path(task_template)
        if relative_template_path is None:
            # invalid template
            raise TemplateNotFound(task_template)

        mtime = relative_template_path.stat().st_mtime

        with open(relative_template_path, encoding="utf-8") as f:
            source = f.read()

        # the third element is a callable that returns True if the template is still up-to-date
        return source, relative_template_path, lambda: relative_template_path.stat().st_mtime == mtime



def create_app():
    app = Flask(__name__, instance_relative_config=True)
    config_file = Path(app.root_path).joinpath("config.py")
    if config_file.exists():
        app.config.from_pyfile(config_file, silent=True)
    else:
        raise Exception("No config file found!")

    app_root_path = Path(app.root_path)
    exams_root_directory = Path(app.config.get('EXAM_DATA_DIRECTORY', "data/exams"))
    if not exams_root_directory.absolute():
        exams_root_directory = app_root_path.joinpath(exams_root_directory)

    if not exams_root_directory.is_dir():
        raise Exception(f"Exam root directory {exams_root_directory} does not exist")


    app.register_blueprint(base.bp)
    app.register_blueprint(grading.gradingbp)
    app.register_blueprint(review.reviewbp)
    app.register_blueprint(tasks.bp)
    app.register_blueprint(api_exams.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api_admin.bp)


    app.jinja_loader = ChoiceLoader([
        FileSystemLoader([ app_root_path.joinpath("templates") ]),
        ExamTemplateLoader()
    ])

    return app
