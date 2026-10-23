import JSZip from 'jszip'
import { AppError } from "./AppError";
import {GradingType} from "@/models/Enums";
import {FileMapping} from "@/models/FileMapping";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import {MapHelper} from "@/models/MapHelper";

export class CsvExport {
    filename: string;
    csvHeaders: Array<string>;
    csvBody: Array<string>;
    separator: string;

    constructor(filename: string, csvHeaders: Array<string>, separator: string = ";") {
        this.filename = filename
        this.csvHeaders = csvHeaders
        this.separator = separator
        this.csvBody = []
    }

    addRow(attributesMap: Map<string, string>) {
        const row = []
        for (let header of this.csvHeaders) {
            if (attributesMap.has(header)) {
                row.push(this.#escapeAttribute(attributesMap.get(header)))
            } else {
                row.push("")
            }
        }

        let line = row.join(this.separator)
        this.csvBody.push(line)
    }

    buildFileContent(): string {
        return [this.csvHeaders.join(this.separator), ...this.csvBody].join('\n')
    }

    download() {
        const csvContent = this.buildFileContent()

        const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"})

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", this.filename);
        link.style.display = "none"
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    #escapeAttribute(value: string): string {
        // remove all new lines
        value = value.replaceAll("\r\n", "").replaceAll("\n", "")
        if (value.includes(this.separator)) {
            // the value contains a separator, so we have to wrap the whole string in double quotes
            if (value.includes('"')) {
                // the value also contains a double quote, so we first escape all double quotes: " -> "" (in csv)
                value = value.replaceAll('"', '""')
            }
            return '"' + value + '"'
        }
        return value
    }
}


export class ExamDataExport {
    fileName: string;
    zipFile: JSZip;

    constructor(fileName: string) {
        this.fileName = fileName
        this.zipFile = new JSZip()
    }

    addSubmissionFile(examineeIdentifier: string, submissionFileName: string, submissionContent: string): void {
        if (examineeIdentifier.length === 0) {
            throw new AppError("There was an error while packing the exam data export. The provided examinee identifier was invalid.")
        }
        if (submissionFileName.length === 0 || submissionContent === null) {
            throw new AppError("There was an error while packing the exam data export. The provided submission was invalid (name or content).")
        }

        this.#addFileToZip(examineeIdentifier + "/submissions/" + submissionFileName, submissionContent)
    }

    addPersonalData(examineeIdentifier: string, seatNumber: number, studentId: number, lastName: string, firstName: string): void {
        this.#addFileToZip(examineeIdentifier + "/personal-data.json", JSON.stringify({
            "seat-number": seatNumber,
            "student-id": studentId,
            "last-name": lastName,
            "first-name": firstName
        }))
    }

    addGradingFile(examineeIdentifier: string, fileName: string, points: number, comment: string, annotation: string, gradingType: GradingType): void {
        this.#addFileToZip(examineeIdentifier + "/gradings/" + fileName, JSON.stringify({
            "points": points,
            "comment": comment,
            "annotation": annotation,
            "grading-type": gradingType
        }))
    }

    addReassessmentResult(examineeIdentifier: string, approved: boolean, answerFilesHashHex: string, gradingFilesHashHex: string, publicKeyHex: string, signatureHex: string): void {
        this.#addFileToZip(examineeIdentifier + "/reassessment-result.json", JSON.stringify({
            "approved": approved,
            "answer-files-hash-hex": answerFilesHashHex,
            "grading-files-hex": gradingFilesHashHex,
            "public-key-hex": publicKeyHex,
            "signature-hex": signatureHex
        }))
    }

    addGraderPublicKeys(validPublicKeys: Map<string, string>): void {
        this.#addFileToZip("grader-public-keys.json", JSON.stringify(Object.fromEntries(validPublicKeys)))
    }

    addGradeExport(gradeExport: CsvExport): void {
        this.#addFileToZip("grade-export.csv", gradeExport.buildFileContent())
    }

    addSummarizedSubtaskPointsExport(summarizedSubtaskPointsExport: CsvExport): void {
        this.#addFileToZip("points-per-subtask-export.csv", summarizedSubtaskPointsExport.buildFileContent())
    }

    addSubtaskFieldGradingExport(subtaskFieldGradingExport: CsvExport): void {
        this.#addFileToZip("gradings-per-field-export.csv", subtaskFieldGradingExport.buildFileContent())
    }

    addFileMapping(examineeIdentifier: string, fileMapping: FileMapping): void {
        this.#addFileToZip(examineeIdentifier + "/file-mapping.json", fileMapping.toJSON())
    }

    addGradeCalculation(examGradeCalculation: ExamGradeCalculation): void {
        this.#addFileToZip("grade-calculation.json", JSON.stringify(examGradeCalculation.gradeLimitsToObject()))
    }

    download() {
        this.zipFile.generateAsync({type: "blob"}).then((content) => {
          const blob = new Blob([content], { type: "application/zip" })

          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.setAttribute("href", url)
          link.setAttribute("download", this.fileName)
          link.style.display = "none"
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        })
    }

    #addFileToZip(filePath: string, fileContent: string): void {
        const fileInZip = this.zipFile.file(filePath)
        if (fileInZip !== null) {
            throw new AppError("There was an error while packing the exam data export. The file " + filePath + " already was present in the zip archive. This should not be the case.")
        }
        this.zipFile.file(filePath, fileContent)
    }

}

export class RecoveryFile {
    static FILE_ENDING = ".pg";
    examName: string;
    uuid: string;
    masterDecryptionPrivateKey: string;
    privateSigningKey: string;

    constructor(examName: string, uuid: string, masterDecryptionPrivateKey: string, privateSigningKey: string) {
        this.examName = examName
        this.uuid = uuid
        this.masterDecryptionPrivateKey = masterDecryptionPrivateKey
        this.privateSigningKey = privateSigningKey
    }

    buildFileContent(): string {
        return JSON.stringify({
            "examName": this.examName,
            "uuid": this.uuid,
            "masterDecryptionPrivateKey": this.masterDecryptionPrivateKey,
            "privateSigningKey": this.privateSigningKey
        })
    }

    download() {
        const jsonContent = this.buildFileContent()
        const fileName = "recovery-file-" + this.examName + ".pg"

        const blob = new Blob([jsonContent], {type: "text/json;charset=utf-8;"})

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.display = "none"
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    matches(recoveryFile: RecoveryFile): boolean {
        return recoveryFile.examName === this.examName && recoveryFile.uuid === this.uuid && recoveryFile.privateSigningKey === this.privateSigningKey && recoveryFile.masterDecryptionPrivateKey === this.masterDecryptionPrivateKey
    }

    static async fromUploadedFile(file) {
        const fileContent = await RecoveryFile.#readFile(file)

        const obj = JSON.parse(fileContent)

        const map = MapHelper.deepMapify(obj)

        if (!map.has('examName') || typeof map.get('examName') !== 'string') {
            throw new AppError("Invalid recovery file. Property examName is invalid.")
        }
        if (!map.has('uuid') || typeof map.get('uuid') !== 'string') {
            throw new AppError("Invalid recovery file. Property uuid is invalid.")
        }
        if (!map.has('masterDecryptionPrivateKey') || typeof map.get('masterDecryptionPrivateKey') !== 'string') {
            throw new AppError("Invalid recovery file. Property masterDecryptionPrivateKey is invalid.")
        }
        if (!map.has('privateSigningKey') || typeof map.get('privateSigningKey') !== 'string') {
            throw new AppError("Invalid recovery file. Property privateSigningKey is invalid.")
        }

        return new RecoveryFile(map.get('examName'), map.get('uuid'), map.get('masterDecryptionPrivateKey'), map.get('privateSigningKey'))
    }

    static #readFile(file: Blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = e => resolve(e.target.result)
            reader.onerror = e => reject(e)
            reader.readAsText(file, "UTF-8")
        });
    }
}