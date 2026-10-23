import {ExamineeSubmissions, IndividualExamineeSubmissions, Submission} from "@/models/ExamineeSubmissions";
import {
    ExamGradingProgress,
    ExamineeGradingPoints,
    GradingPoints,
    IndividualExamineeGradingPoints
} from "@/models/ExamineeGradingPoints";
import {GroupGradingGroups} from "@/models/GroupGrading";
import {ExamTask, ExamTasksData} from "@/models/ExamTaskData";
import {CsvExport, ExamDataExport} from "@/models/Exporting";
import {AppError} from "@/models/AppError";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import {FileMapping} from "@/models/FileMapping";
import ExamApi from "@/models/ExamApi";

export class PairedExamineeGradingSubmissions {
    examineeSubmissions: ExamineeSubmissions;
    examineeGradingPoints: ExamineeGradingPoints;

    constructor(examineeSubmissions: ExamineeSubmissions, examineeGradingPoints: ExamineeGradingPoints) {
        this.examineeSubmissions = examineeSubmissions
        this.examineeGradingPoints = examineeGradingPoints
    }

    getGroupGradingGroups(subtaskFieldIdentifier: string, trimWhitespaces: boolean, ignoreCapitalization: boolean): GroupGradingGroups {
        console.log("Grouping by", subtaskFieldIdentifier)

        if (subtaskFieldIdentifier === null) {
            return new GroupGradingGroups()
        }

        let subtaskIdentifier = subtaskFieldIdentifier.split("_")[0]

        const groups = new GroupGradingGroups()
        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {

            // note: exclude all no-shows and examinees that chose no-grading
            if (individualExamineeSubmission.isNoShow() || individualExamineeSubmission.isNoGradingChosen()) {
                continue
            }

            let examineeIdentifier = individualExamineeSubmission.examineeIdentifier

            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Cannot create groups to be used for group grading when there are missing gradings")
            }

            let individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            // get the submission and grading points for the given subtask field
            // careful: might be null when there was no submission at all meaning the examinee did not submit anything for that field (not even blank)
            let submission = individualExamineeSubmission.getSubtaskFieldAnswer(subtaskFieldIdentifier)

            let gradingPoints = individualExamineeGradings.getGradingPointsForSubtaskField(subtaskFieldIdentifier)
            if (gradingPoints === null) {
                throw new AppError("Grading points cannot be null during creating groups to be used for group grading")
            }

            // every submission gets counted
            groups.incrementTotalSubmissions()

            if (submission !== null && submission.isLocked()) {
                groups.incrementLockedSubmission()
                continue
            }

            if (gradingPoints.isPointsLocked() || gradingPoints.isAnnotationLocked()) {
                groups.incrementLockedGradings()
                continue
            }

            let submittedValue = submission !== null ? submission.submittedValue : null

            if (submittedValue !== null) {
                if (ignoreCapitalization)
                    submittedValue = submittedValue.toLowerCase()
                if (trimWhitespaces)
                    submittedValue = submittedValue.trim()
            }
            groups.addGradingGroup(submittedValue, gradingPoints)

        }

        return groups
    }

    getGradingProgress(examTasksData: ExamTasksData): ExamGradingProgress {
        const examGradingProgress = new ExamGradingProgress()
        examGradingProgress.allGradingsDone = true

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {

            // note: exclude all no-shows and examinees that chose no-grading
            if (individualExamineeSubmission.isNoShow() || individualExamineeSubmission.isNoGradingChosen()) {
                continue
            }

            let examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                examGradingProgress.allGradingsDone = false
                examGradingProgress.somePointsLocked = true
                break
            }

            let individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            let summarizedExamPoints = individualExamineeGradings.getSummarizedExamPoints(examTasksData)

            if (summarizedExamPoints.somePointsLocked) {
                examGradingProgress.somePointsLocked = true
            }
            if (!summarizedExamPoints.allGradingsDone) {
                examGradingProgress.allGradingsDone = false
            }
            if (summarizedExamPoints.inconsistentGradings) {
                examGradingProgress.inconsistentGradings = true
            }

            if (examGradingProgress.somePointsLocked && !examGradingProgress.allGradingsDone && examGradingProgress.inconsistentGradings) {
                // worst case already reached, no need to consider other gradings
                break
            }

        }

        return examGradingProgress
    }

    exportGrades(examName: string, examTasksData: ExamTasksData, gradeCalculation: ExamGradeCalculation, abortOnIncompleteGradingAndInconsistencies: boolean): CsvExport {

        const FLEX_NOW_COLUMNS = ['Matrnr', 'Nachname', 'Vorname', 'Punkte', 'Note']

        const csvExport: CsvExport = new CsvExport("grade-export_" + examName + ".csv", FLEX_NOW_COLUMNS)

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {

            // exclude the examinees that are no-shows
            if (individualExamineeSubmission.isNoShow()) {
                continue
            }

            let examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Insufficient permissions: Cannot generate grade export without access to gradings of all examinees")
            }

            let individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            let summarizedExamPoints = individualExamineeGradings.getSummarizedExamPoints(examTasksData, gradeCalculation)

            if (summarizedExamPoints.somePointsLocked) {
                throw new AppError("Insufficient permissions: Cannot generate grade export without access to all awarded points")
            }
            if (!summarizedExamPoints.allGradingsDone && abortOnIncompleteGradingAndInconsistencies) {
                throw new AppError("Cannot generate grade export when there are unfinished gradings. Please grade all submissions of examinees.")
            }
            if (summarizedExamPoints.inconsistentGradings && abortOnIncompleteGradingAndInconsistencies) {
                throw new AppError("Cannot generate grade export when there are inconsistent gradings. Please fix the inconsistencies (e.g., points exceeding maximum points) first.")
            }
            if (individualExamineeSubmission.isPersonalDataLocked()) {
                throw new AppError("Insufficient permissions: Cannot generate grade export without access to the personal data (names and student ids) of all examinees.")
            }

            const columns = new Map<string, string>()
            columns.set("ID", individualExamineeSubmission.personalData.studentId.toString())
            columns.set("Lastname", individualExamineeSubmission.personalData.lastName)
            columns.set("Firstname", individualExamineeSubmission.personalData.firstName)
            columns.set("Points", summarizedExamPoints.achievedPoints.toString())
            columns.set("Grade", summarizedExamPoints.achievedGrade.toString())

            csvExport.addRow(columns)

        }

        return csvExport

    }

    exportSubtaskFieldGradings(examName: string, examTasksData: ExamTasksData, exportableFields: Object, includePersonalData: boolean, includeComments: boolean, includeInternalAnnotation: boolean): CsvExport {
        const columns = ["examinee identifier"]

        if (includePersonalData === true) {
            columns.push("last name", "first name", "student id")
        }

        const subtaskFieldsToExport = []

        for (let subtaskField of examTasksData.getSubtaskFields()) {
            let subtaskFieldName = subtaskField.identifier
            if (exportableFields === null || (Object.prototype.hasOwnProperty.call(exportableFields, subtaskFieldName) && exportableFields[subtaskFieldName] === true)) {
                subtaskFieldsToExport.push(subtaskFieldName)
                columns.push(subtaskFieldName + " points")
                if (includeComments === true) {
                    columns.push(subtaskFieldName + " comment")
                }
                if (includeInternalAnnotation === true) {
                    columns.push(subtaskFieldName + " annotation")
                }
            }
        }

        const csvExport = new CsvExport("field-gradings-export_" + examName + ".csv", columns)

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {

            // exclude the examinees that are no-shows
            if (individualExamineeSubmission.isNoShow()) {
                continue
            }

            let examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Insufficient permissions: Cannot generate gradings export without access to gradings of all examinees")
            }

            let individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            if (includePersonalData === true && individualExamineeSubmission.isPersonalDataLocked()) {
                throw new AppError("Insufficient permissions: Cannot generate gradings export without access to the personal data (names and student ids) of all examinees.")
            }

            const columns = new Map<string, string>()

            columns.set("examinee identifier", examineeIdentifier)

            if (includePersonalData === true) {
                columns.set("last name", individualExamineeSubmission.personalData.lastName)
                columns.set("first name", individualExamineeSubmission.personalData.firstName)
                columns.set("student id", individualExamineeSubmission.personalData.studentId.toString())
            }

            for (let subtaskFieldName of subtaskFieldsToExport) {
                let gradingPoints = individualExamineeGradings.getGradingPointsForSubtaskField(subtaskFieldName)
                if (gradingPoints === null) {
                    throw new AppError("Cannot export invalid subtask field")
                }
                if (gradingPoints.isPointsLocked() || (gradingPoints.isAnnotationLocked() && includeInternalAnnotation === true)) {
                    throw new AppError("Insufficient permission: Cannot generate grading export without access to the exported subtask fields")
                }
                columns.set(subtaskFieldName + " points", gradingPoints.points === null ? "?" : gradingPoints.points.toString())
                columns.set(subtaskFieldName + " comment", gradingPoints.comment === null ? "" : gradingPoints.comment)
                columns.set(subtaskFieldName + " annotation", gradingPoints.annotation === null ? "" : gradingPoints.annotation)
            }

            csvExport.addRow(columns)
        }

        return csvExport
    }

    exportSubtaskPoints(examName: string, examTasksData: ExamTasksData): CsvExport {
        const columns = ["last name", "first name", "student id"]

        for (let subtask of examTasksData.getSubtasks()) {
            columns.push(subtask.name)
        }

        const csvExport = new CsvExport("subtask-points-export_" + examName + ".csv", columns)

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {

            // exclude the examinees that are no-shows
            if (individualExamineeSubmission.isNoShow()) {
                continue
            }

            let examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Insufficient permissions: Cannot generate subtask points export without access to gradings of all examinees")
            }

            let individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            if (individualExamineeSubmission.isPersonalDataLocked()) {
                throw new AppError("Insufficient permissions: Cannot generate subtask points export without access to the personal data (names and student ids) of all examinees.")
            }

            const columns = new Map<string, string>()

            columns.set("last name", individualExamineeSubmission.personalData.lastName)
            columns.set("first name", individualExamineeSubmission.personalData.firstName)
            columns.set("student id", individualExamineeSubmission.personalData.studentId.toString())


            for (let subtask of examTasksData.getSubtasks()) {
                let summarizedSubtaskPoints = individualExamineeGradings.getSummarizedSubtaskPoints(examTasksData, subtask.name)

                let content = ""

                if (summarizedSubtaskPoints.somePointsLocked) {
                    content = "LOCKED"
                } else if (summarizedSubtaskPoints.summarizedPoints > subtask.points) {
                    content = "INCONSISTENT"
                } else if (summarizedSubtaskPoints.allGradingsDone) {
                    content = summarizedSubtaskPoints.summarizedPoints.toString()
                } else {
                    content = summarizedSubtaskPoints.summarizedPoints.toString() + "+"
                }

                columns.set(subtask.name, content)
            }

            csvExport.addRow(columns)
        }

        return csvExport
    }

    async exportExamData(examName: string, examTasksData: ExamTasksData, examGradeCalculation: ExamGradeCalculation, abortOnInconsistencies: boolean, abortOnIncompleteGradings: boolean, abortOnInvalidReassessments: boolean): Promise<ExamDataExport> {
        const examDataExport = new ExamDataExport("exam-export_" + examName + ".zip")

        let abortOnIncompleteGradingAndInconsistencies = abortOnInconsistencies || abortOnIncompleteGradings

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {
            const examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            const fileMapping = new FileMapping(new Map())

            // export the submissions
            for (let submission of individualExamineeSubmission.submissions.values()) {
                if (submission.isLocked()) {
                    throw new AppError("Cannot export exam data because a submission of " + examineeIdentifier + " is locked")
                }

                fileMapping.addEntry(submission.submissionFieldName, submission.mappedFileName)
                examDataExport.addSubmissionFile(examineeIdentifier, submission.submissionFieldName, submission.submittedValue)
            }

            // export personal data
            if (individualExamineeSubmission.isPersonalDataLocked()) {
                throw new AppError("Cannot export exam data because the personal data of " + examineeIdentifier + " is locked")
            }
            const personalData = individualExamineeSubmission.getPersonalData()
            examDataExport.addPersonalData(examineeIdentifier, personalData.seatNumber, personalData.studentId, personalData.lastName, personalData.firstName)

            // export the gradings and the reassessment result
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Insufficient permissions: Cannot generate exam data export without access to gradings of all examinees")
            }
            let individualExamineeGradings: IndividualExamineeGradingPoints = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            // 1. check for the current grading state
            const summarizedExamPoints = individualExamineeGradings.getSummarizedExamPoints(examTasksData, examGradeCalculation)
            if (summarizedExamPoints.inconsistentGradings && abortOnInconsistencies) {
                throw new AppError("Consistency check failed: The exam points of " + examineeIdentifier + " contain inconsistent gradings")
            }
            if (!summarizedExamPoints.allGradingsDone && abortOnIncompleteGradings) {
                throw new AppError("Consistency check failed: The submissions of " + examineeIdentifier + " were not fully graded yet")
            }

            // 2. export the actual gradings
            for (let gradingPoints of individualExamineeGradings.gradingPoints.values()) {

                if (gradingPoints.isPointsLocked()) {
                    throw new AppError("Cannot export exam data because a grading of " + examineeIdentifier + " is locked (points not accessible)")
                }
                if (gradingPoints.isAnnotationLocked()) {
                    throw new AppError("Cannot export exam data because a grading of " + examineeIdentifier + " is locked (annotation not accessible)")
                }
                if (gradingPoints.isGradingTypeLocked()) {
                    throw new AppError("Cannot export exam data because a grading of " + examineeIdentifier + " is locked (grading type not accessible)")
                }

                fileMapping.addEntry(gradingPoints.gradingPointsFileName, gradingPoints.mappedFileName)
                examDataExport.addGradingFile(examineeIdentifier, gradingPoints.gradingPointsFileName, gradingPoints.points, gradingPoints.comment, gradingPoints.annotation, gradingPoints.gradingType)
            }

            // 3. export the reassessment result
            const reassessmentResult = individualExamineeGradings.getReassessmentResult()

            if (reassessmentResult.isLocked()) {
                throw new AppError("Cannot export exam data because the reassessment result of " + examineeIdentifier + " is locked")
            }

            if (!individualExamineeSubmission.isNoShow() && !summarizedExamPoints.alreadyPassed) {
                // check whether the reassessment result is valid (for examinees that did not pass AND are shows)
                const currentGradingFilesHashHex = await individualExamineeGradings.calculateHashOverGradings(examName)
                if (abortOnInvalidReassessments && !summarizedExamPoints.alreadyPassed && !reassessmentResult.isApprovedAndValid(this.examineeGradingPoints.validPublicKeys, currentGradingFilesHashHex, individualExamineeSubmission.answerFilesHashHex)) {
                    throw new AppError("Consistency check failed: The reassessment result of " + examineeIdentifier + " (did not pass exam) is invalid")
                }

                examDataExport.addReassessmentResult(examineeIdentifier, reassessmentResult.approved, reassessmentResult.answerFilesHashHex, reassessmentResult.gradingFilesHashHex, reassessmentResult.publicKeyHex, reassessmentResult.signatureHex)
            }

            // export the file mapping for the examinee
            examDataExport.addFileMapping(examineeIdentifier, fileMapping)
        }

        examDataExport.addGraderPublicKeys(this.examineeGradingPoints.validPublicKeys.validPublicKeys)
        examDataExport.addGradeExport(this.exportGrades(examName, examTasksData, examGradeCalculation, abortOnIncompleteGradingAndInconsistencies))
        examDataExport.addSummarizedSubtaskPointsExport(this.exportSubtaskPoints(examName, examTasksData))
        examDataExport.addSubtaskFieldGradingExport(this.exportSubtaskFieldGradings(examName, examTasksData, null, true, true, true))
        examDataExport.addGradeCalculation(examGradeCalculation)

        return examDataExport
    }

    exportPostExamReviewInviteLinks(examApi: ExamApi): CsvExport {
        let columns;
        let baseFileName;
        let separator;

        columns =  ["last name", "first name", "student id", "url"]
        separator = ";"
        baseFileName = "examinee-review-links"

        const csvExport = new CsvExport(baseFileName + "_" + examApi.examName + ".csv", columns, separator)

        for (let individualExamineeSubmission of this.examineeSubmissions.getIndividualExamineeSubmissions()) {
            // no-shows do not have a review link
            if (individualExamineeSubmission.isNoShow()) {
                continue
            }

            const examineeIdentifier = individualExamineeSubmission.examineeIdentifier
            if (!this.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Insufficient permissions: Cannot export review links without access to gradings of all examinees")
            }

            const individualExamineeGradings = this.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            if (individualExamineeSubmission.isPersonalDataLocked()) {
                throw new AppError("Insufficient permissions: Cannot export review links without access to the personal data (names and student ids) of all examinees.")
            }

            const postExamReviewData = individualExamineeGradings.getPostExamReviewData()

            if (postExamReviewData.areCredentialsLocked()) {
                throw new AppError("Insufficient permissions: Cannot export review links without access to the personalized review data of all examinees.")
            }

            const columns = new Map<string, string>()


            columns.set("first name", individualExamineeSubmission.personalData.firstName)
            columns.set("last name", individualExamineeSubmission.personalData.lastName)
            columns.set("student id", individualExamineeSubmission.personalData.studentId.toString())
            columns.set("url", examApi.buildPostExamReviewInviteURL(examineeIdentifier, postExamReviewData.getExamineeUuid(), postExamReviewData.getExamineeMasterKey()))

            csvExport.addRow(columns)
        }

        return csvExport
    }

}