import logging
from datetime import datetime
from pathlib import Path
from app.importing.importer import ExamImporter

def main():
    # -- CONFIG FOR THE IMPORT --

    local_data_directory = Path("data/")
    importable_exams_directory = local_data_directory.joinpath('importable-exams')
    target_exams_directory = local_data_directory.joinpath('exams')
    local_keys_directory = local_data_directory.joinpath('local-exam-keys')

    # ask the user what to import
    print("Found the importable exams:")
    importable_exams = list()
    for importable_exam in sorted(importable_exams_directory.iterdir()):
        if importable_exam.is_file():
            continue
        exam_name = importable_exam.name

        required_files_and_directories = [('exam-files', True), ('uploaded-files', True), ('registrations.csv', False), ('roomsecret-mapping.txt', False)]

        if not all((importable_exam.joinpath(required_file).is_file() and must_be_directory is False or importable_exam.joinpath(required_file).is_dir() and must_be_directory is True) for required_file, must_be_directory in required_files_and_directories):
            print("-", exam_name, "(missing files)")
            continue

        if target_exams_directory.joinpath(exam_name).is_dir():
            print("-", exam_name, "(already imported)")
            continue

        print(f'{len(importable_exams)+1}) {exam_name}')
        importable_exams.append(importable_exam)

    if len(importable_exams) == 0:
        print("> No importable exams found. Exiting.")
        exit(0)

    print()
    exam_to_import = input("Provide the number of the exam to import: ")

    try:
        exam_to_import = int(exam_to_import)
        exam_to_import = importable_exams[exam_to_import-1]
    except ValueError:
        print("ERR: Input must be an integer.")
        exit(1)
    except IndexError:
        print("ERR: Input must be between 1 and", len(importable_exams))
        exit(1)

    log_file_path = local_data_directory.joinpath('logs').joinpath(datetime.now().strftime(f"import_{exam_to_import.name}_%Y-%m-%d_%H-%M-%S.log"))
    logging.basicConfig(filename=log_file_path, filemode="w", level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    target_exam_directory = target_exams_directory.joinpath(exam_to_import.name)

    # NOTE This value differs for each exam. The value is dynamically chosen when importing a specific exam.
    # NOTE It must be a larger value than the longest answer and depends on the exam answers.
    pad_submissions_to_length = 512 # bytes

    importer = ExamImporter(exam_to_import, target_exam_directory, local_keys_directory, pad_submissions_to_length)
    importer.import_exam()


if __name__ == '__main__':
    main()
