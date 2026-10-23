import {CsvExport} from "@/models/Exporting";
import {PairedExamineeGradingSubmissions} from "@/models/PairedExamineeGradingSubmissions";
import {GradingPoints} from "@/models/ExamineeGradingPoints";
import {GradingType} from "@/models/Enums";
import ExamApi from "@/models/ExamApi";
import {AppError} from "@/models/AppError";

export class CSVParser {
    delimiter: string;
    encoding: string;
    hasHeaders: boolean;

    constructor(hasHeaders: boolean = true, delimiter: string = ";", encoding: string = "UTF-8") {
        this.delimiter = delimiter
        this.encoding = encoding
        this.hasHeaders = hasHeaders
    }

    async parseFile(file) {
        const text = await this.#readFile(file)
        return this.parse(text)
    }

    parse(csvText: string): Array<any> {
        const rows = []
        let current = ''
        let row = []
        let insideQuotes = false
        let i = 0
        let isFieldStart = true

        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (isFieldStart && char === '"') {
                insideQuotes = true
                isFieldStart = false
                i++
                continue
            }

            if (char === '"' && insideQuotes && nextChar === '"') {
                current += '"'
                i += 2
                continue
            }

            if (insideQuotes && char === '"') {
                insideQuotes = false;
                i++;
                continue;
            }

            if (char === this.delimiter && !insideQuotes) {
                row.push(current)
                current = ''
                isFieldStart = true
                i++
                continue
            }

            if ((char === '\n' || char === '\r') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') i++
                row.push(current)
                current = ''
                rows.push(row)
                isFieldStart = true
                row = []
                i++
                continue
            }

            current += char
            isFieldStart = false
            i++
        }

        if (current.length > 0 || row.length > 0) {
            row.push(current)
            rows.push(row)
        }

        if (this.hasHeaders && rows.length > 0) {
            const headers = rows.shift()

            return rows.map(r => {
                const map = new Map()
                headers.forEach((h, idx) => map.set(h, r[idx] || ''))
                return map
            });
        }

        return rows
    }

    #readFile(file: Blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = e => resolve(e.target.result)
            reader.onerror = e => reject(e)
            reader.readAsText(file, this.encoding)
        });
    }
}


export class SubtaskFieldGradingsImport {
    subtaskFieldName: string;
    importableData: Array<Map<string, string>>;

    constructor(subtaskFieldName: string, importableData: Array<Map<string, string>>) {
        this.subtaskFieldName = subtaskFieldName
        this.importableData = importableData

    }

    async prepareData(pairedExamineeGradingSubmissions: PairedExamineeGradingSubmissions) {
        let changelog = new Array<string>();
        let subtaskIdentifier = this.subtaskFieldName.split("_")[0]

        let recordIdx = 0

        let savableGradingPoints: GradingPoints[] = []

        for (let importableRecord of this.importableData) {
            recordIdx += 1

            const expectedHeaders = SubtaskFieldGradingsImport.getExpectedHeaders(this.subtaskFieldName)

            if (!expectedHeaders.every(header => importableRecord.has(header))) {
                throw new AppError("Importing failed as the importable data does not have expected fields: " + expectedHeaders)
            }

            if (!expectedHeaders.every(header => typeof importableRecord.get(header) === 'string')) {
                throw new AppError("Importing failed as the fields in line " + recordIdx.toString() + " do not have the expected type (string)")
            }

            let examineeIdentifier = importableRecord.get('examinee identifier').trim()
            let importedPointsString = importableRecord.get(this.subtaskFieldName + " points").trim()
            let importedComment = importableRecord.get(this.subtaskFieldName + " comment").trim()
            let importedAnnotation = importableRecord.get(this.subtaskFieldName + " annotation").trim()

            if (examineeIdentifier.length === 0) {
                throw new AppError("Importing failed as the examinee identifier in line " + recordIdx.toString() + " is invalid")
            }

            if (importedPointsString.length === 0 && importedComment.length === 0 && importedAnnotation.length === 0) {
                // there is no grading to import, we just skip
                continue
            }

            if (!pairedExamineeGradingSubmissions.examineeSubmissions.hasSubmissionsOf(examineeIdentifier)) {
                throw new AppError("Importing failed due to insufficient permission: Examinee's submission with identifier " + examineeIdentifier + " in line " + recordIdx.toString() + " cannot be accessed")
            }
            if (!pairedExamineeGradingSubmissions.examineeGradingPoints.hasGradingPointsOf(examineeIdentifier)) {
                throw new AppError("Importing failed due to insufficient permission: Examinee's gradings with identifier " + examineeIdentifier + " in line " + recordIdx.toString() + " cannot be accessed")
            }

            const examineeSubmissions = pairedExamineeGradingSubmissions.examineeSubmissions.getSubmissionsOf(examineeIdentifier)
            const examineeGradingPoints = pairedExamineeGradingSubmissions.examineeGradingPoints.getGradingsOf(examineeIdentifier)

            if (examineeSubmissions === null) {
                throw new AppError("Cannot access the submissions of examinee " + examineeIdentifier + " (line " + recordIdx + ")")
            }

            if (examineeGradingPoints === null) {
                throw new AppError("Cannot access any gradings of examinee " + examineeIdentifier + " (line " + recordIdx + ")")
            }

            const gradingPoints = examineeGradingPoints.getGradingPointsForSubtaskField(this.subtaskFieldName)
            if (gradingPoints === null) {
                throw new AppError("Cannot access the subtask field gradings of examinee " + examineeIdentifier + " (line " + recordIdx + ")")
            }

            if (gradingPoints.isPointsLocked() || gradingPoints.isAnnotationLocked()) {
                throw new AppError("Insufficient permission to change gradings of examinee " + examineeIdentifier + " (line " + recordIdx + ")")
            }

            if (examineeSubmissions.isNoShow()) {
                throw new AppError("Cannot change gradings for no-shows (no-show: " + examineeIdentifier + ")")
            }

            if (examineeSubmissions.isNoGradingChosen()) {
                changelog.push("Gradings for examinee " + examineeIdentifier + " (line " + recordIdx + ") will not be updated (examinee chose no grading)")
                continue
            }

            if (importedComment.includes("\n") || importedAnnotation.includes("\n") || importedComment.includes("\r") || importedAnnotation.includes("\r")) {
                throw new AppError("Gradings for examinee " + examineeIdentifier + " (line " + recordIdx + ") contain invalid characters. Gradings must be single-line only; no line breaks (\\n) are allowed.")
            }

            let parsedPoints = null

            if (importedPointsString.length !== 0) {
                // there are points specified
                if (Number.isInteger(Number(importedPointsString)) && Number(importedPointsString) >= 0) {
                    // points are valid
                    parsedPoints = Number(importedPointsString)
                } else {
                    throw new AppError("Invalid provided points for examinee " + examineeIdentifier + " (line " + recordIdx + ")")
                }
            } else {
                // there are no points specified
                if (importedComment.length > 0) {
                    // ... but there is a comment => error
                    throw new AppError("Cannot import gradings with comment but with no provided points for examinee " + examineeIdentifier + " (line " + recordIdx + ")")
                }
            }

            let parsedComment = importedComment.length > 0 ? importedComment : null
            let parsedAnnotation = importedAnnotation.length > 0 ? importedAnnotation : null

            if (parsedPoints === gradingPoints.points && parsedComment === gradingPoints.comment && parsedAnnotation === gradingPoints.annotation) {
                // no changes are to be made
                continue
            }

            // some changes must be saved ...
            gradingPoints.points = parsedPoints
            gradingPoints.comment = parsedComment
            gradingPoints.annotation = parsedAnnotation
            gradingPoints.gradingType = GradingType.IMPORTED_GRADING

            savableGradingPoints.push(gradingPoints)

            changelog.push("Will update gradings for examinee " + examineeIdentifier + " (line " + recordIdx + ") and set grading to " + gradingPoints.toInputValue())
        }

        if (savableGradingPoints.length === 0) {
            changelog = ["Imported data is equivalent to current data. No changes will be made."]
        }

        return {
            "changelog": changelog,
            "savableGradingPoints": savableGradingPoints
        }
    }

    getRecords(): Array<Map<string, string>> {
        return this.importableData
    }

    getHeaders(): string[] {
        return [...this.importableData[0].keys()]
    }

    static async fromUploadedFile(subtaskFieldName: string, file) {
        const csvParser = new CSVParser()
        const records = await csvParser.parseFile(file)

        const expectedHeaders = SubtaskFieldGradingsImport.getExpectedHeaders(subtaskFieldName)

        if (records.length === 0) {
            throw new AppError("The provided CSV file contains no records")
        }

        // get the present headers extracted from the first line of the csv
        const foundHeaders = [...records[0].keys()]

        if (foundHeaders.length !== expectedHeaders.length || !expectedHeaders.every(expectedHeader => foundHeaders.includes(expectedHeader))) {
            throw new AppError("The provided CSV file does not have expected headers: " + expectedHeaders.toString() + ". Found headers: " + foundHeaders.toString())
        }

        return new SubtaskFieldGradingsImport(subtaskFieldName, records)
    }

    static getExpectedHeaders(subtaskFieldName: string): string[] {
        if (typeof subtaskFieldName !== 'string' || subtaskFieldName.trim().length === 0) {
            throw new AppError("Invalid subtask field name")
        }

        subtaskFieldName = subtaskFieldName.trim()
        return ["examinee identifier", subtaskFieldName + " points", subtaskFieldName + " comment", subtaskFieldName + " annotation"]
    }
}