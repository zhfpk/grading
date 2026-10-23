import {DataState, KeyType} from "@/models/Enums";
import {FileMapping} from "@/models/FileMapping";
import {User} from "@/models/User";
import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";
import NaClCrypto from "@/models/NaClCrypto";
import ExamApi, {EXAMINATION_SYSTEM_PUBLIC_KEY_HEX} from "@/models/ExamApi";


export class ExamineeSubmissions {
    examineeSubmissionsMap: Map<string, IndividualExamineeSubmissions>

    constructor() {
        this.examineeSubmissionsMap = new Map<string, IndividualExamineeSubmissions>()
    }

    hasSubmissionsOf(examineeIdentifier: string): boolean {
        return this.examineeSubmissionsMap.has(examineeIdentifier)
    }

    getSubmissionsOf(examineeIdentifier: string): IndividualExamineeSubmissions {
        return this.examineeSubmissionsMap.get(examineeIdentifier)
    }

    set(examineeIdentifier: string, examineeGradingPoints: IndividualExamineeSubmissions) {
        this.examineeSubmissionsMap.set(examineeIdentifier, examineeGradingPoints)
    }

    getNeighboringExaminee(examineeIdentifier: string) {
        const relevantExaminees = [...this.examineeSubmissionsMap.keys()]
        const currentIdx = relevantExaminees.indexOf(examineeIdentifier)
        return {
            previous: (currentIdx-1) >= 0 ? relevantExaminees[currentIdx-1] : null,
            next: (currentIdx+1) < relevantExaminees.length ? relevantExaminees[currentIdx+1] : null
        }
    }

    getIndividualExamineeSubmissions() {
        return this.examineeSubmissionsMap.values()
    }

}


export class IndividualExamineeSubmissions {
    examineeIdentifier: string;
    anonymizedFirstName: string;
    anonymizedLastName: string;
    personalData: ExamineePersonalData;
    submissions: Map<string, Submission>;
    answerFilesHashHex: string;

    constructor(examineeIdentifier: string, anonymizedFirstName: string, anonymizedLastName: string, submissions: Map<string, Submission>, personalData: ExamineePersonalData, answerFilesHashHex: string) {
        this.examineeIdentifier = examineeIdentifier
        this.anonymizedFirstName = anonymizedFirstName
        this.anonymizedLastName = anonymizedLastName
        this.personalData = personalData
        this.submissions = submissions
        this.answerFilesHashHex = answerFilesHashHex
        console.log("ExamineeSubmissions ->", this)
    }

    getSubmissions() {
        return this.submissions
    }

    getSubtaskFieldAnswer(subtaskFieldIdentifier: string): Submission {
        return this.getSubmission(subtaskFieldIdentifier + ".answer")
    }

    getSubmission(submissionFileName: string) {
        if (!this.submissions.has(submissionFileName)) {
            return null
        }
        return this.submissions.get(submissionFileName)
    }

    isNoShow(): boolean {
        let dataStudentSubmission = this.getSubmission("data.student")

        if (dataStudentSubmission === null)
            throw new AppError("Examinee does not have data.student file. Please report this error to the service provider.")

        if (dataStudentSubmission.isLocked())
            throw new AppError("There is an error in the permission system. The data.student file must be accessible for all graders. Please report this error to the service provider.")

        return dataStudentSubmission.submittedValue === "False"
    }

    isNoGradingChosen(): boolean {
        let examHandInSubmission = this.getSubmission("exam.handin") !== null ? this.getSubmission("exam.handin").submittedValue : null
        if (examHandInSubmission === null)
            throw new AppError("Examinee does not have exam.handin file. Please report this error to the service provider.")
        return examHandInSubmission === "nograding=true"
    }

    getAnonymizedName(lastNameFirst: boolean = false): string {
        if (lastNameFirst)
            return this.anonymizedLastName + " " + this.anonymizedFirstName
        else
            return this.anonymizedFirstName + " " + this.anonymizedLastName
    }

    getAnonymizedNameSeparated(): string {
        return this.anonymizedLastName + ", " + this.anonymizedFirstName
    }

    getPersonalData(): ExamineePersonalData {
        return this.personalData
    }

    isPersonalDataLocked(): boolean {
        return this.personalData === null || this.personalData.isLocked()
    }

    getRealName(lastNameFirst: boolean = false): string {
        if (this.personalData.isLocked()) {
            return null
        } else {
            if (lastNameFirst)
                return this.personalData.lastName + ", " + this.personalData.firstName
            else
                return this.personalData.firstName + " " + this.personalData.lastName
        }
    }

    getFirstFirstName(): string {
        if (this.isPersonalDataLocked()) {
            return null
        } else {
            return this.personalData.firstName.split(" ")[0]
        }
    }

    static async decryptExamineeSubmissions(crypto: NaClCrypto, userData: User, examName: string, examineeIdentifier: string, examineeEncryptedSubmissions: Map<any, any>) {
        if (!examineeEncryptedSubmissions.has("file-mapping.enc")) {
            throw new AppError("Cannot decrypt examinee submissions without the internal file mapping list")
        }

        let encryptedFileMapping = examineeEncryptedSubmissions.get("file-mapping.enc")
        let decryptionKeyFileMapping = userData.getDecryptionKey("file-mapping.enc", KeyType.FILE_KEY, examineeIdentifier)

        await ExaminationSystemSignature.verifySignature(crypto, examName, examineeIdentifier, "file-mapping.enc", examineeEncryptedSubmissions, EXAMINATION_SYSTEM_PUBLIC_KEY_HEX)
        let fileMapping = await FileMapping.decryptFileMapping(encryptedFileMapping, crypto, decryptionKeyFileMapping)

        let decryptedExamineeSubmissions = new Map<string, Submission>()

        let actualSubmissionFiles = fileMapping.getSubmissionFiles()

        for (const [submissionFieldName, mappedFileName] of actualSubmissionFiles.entries()) {
            let decryptionKey = userData.getDecryptionKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier)
            if (examineeEncryptedSubmissions.get(mappedFileName) && decryptionKey !== null) {
                // verify signature of submission
                await ExaminationSystemSignature.verifySignature(crypto, examName, examineeIdentifier, mappedFileName, examineeEncryptedSubmissions, EXAMINATION_SYSTEM_PUBLIC_KEY_HEX)

                // user could download the encrypted submission
                let decryptedSubmittedValue = await crypto.symmetricDecrypt(examineeEncryptedSubmissions.get(mappedFileName), decryptionKey)
                // strip the padding
                const actualSubmissionValue = Submission.stripPadding(decryptedSubmittedValue)
                decryptedExamineeSubmissions.set(submissionFieldName, Submission.createDecryptedSubmission(submissionFieldName, mappedFileName, actualSubmissionValue))
            } else {
                // user could not download the submission but it exists
                decryptedExamineeSubmissions.set(submissionFieldName, Submission.createLockedSubmission(submissionFieldName, mappedFileName))
            }
        }

        return decryptedExamineeSubmissions
    }

    static async calculateAnswerFilesHash(examineeIdentifier: string, submissions: Map<string, Submission>): Promise<string> {
        let contentToHash = ""
        for (let submission of submissions.values()) {
            if (!submission.submissionFieldName.endsWith('.submission')) {
                continue
            }

            if (submission.isLocked()) {
                return null
            }

            contentToHash += "[" + examineeIdentifier + ";" + submission.submissionFieldName + ";" + submission.mappedFileName + ";" + submission.submittedValue + "]"
        }

        return await NaClCrypto.calculateSHA256HexFromString(contentToHash)
    }
}

export class Submission {
    submissionFieldName: string;
    mappedFileName: string;
    dataState: DataState;
    submittedValue: string;

    constructor(submissionFieldName: string, mappedFileName: string, submissionState: DataState, submittedValue: string) {
        this.submissionFieldName = submissionFieldName
        this.mappedFileName = mappedFileName
        this.dataState = submissionState
        this.submittedValue = submittedValue
    }

    isLocked(): boolean {
        return this.dataState === DataState.LOCKED
    }

    static createLockedSubmission(submissionFieldName: string, mappedFileName: string) {
        // to be used when the submission exists (there is a file mapping entry) but the user could not download the value
        // also to be used when the user does not have the key to decrypt the submission (but could download it)
        return new Submission(submissionFieldName, mappedFileName, DataState.LOCKED, null)
    }

    static createDecryptedSubmission(submissionFieldName: string, mappedFileName: string, submittedValue: string) {
        // to be used when the submission exists and could be decrypted by the user
        return new Submission(submissionFieldName, mappedFileName, DataState.UNLOCKED, submittedValue)
    }

    static stripPadding(decryptedSubmission: string, paddingPrefixLength: number = 5) {
        const paddingPrefix = decryptedSubmission.slice(0, paddingPrefixLength)
        const paddingBytes = parseInt(paddingPrefix, 10)
        if (!Number.isInteger(paddingBytes) || paddingBytes < 0 || paddingBytes >= decryptedSubmission.length) {
            throw new AppError("Invalid padding in examinee submission. Please report this error to the service provider.")
        }
        const messageEnd = decryptedSubmission.length - paddingBytes
        const actualSubmission = decryptedSubmission.slice(paddingPrefixLength, messageEnd)
        return actualSubmission
    }
}


export class ExamineePersonalData {
    dataState: DataState;
    seatNumber: number;
    studentId: number;
    lastName: string;
    firstName: string;

    constructor(state: DataState, seatNumber: number, studentId: number, lastName: string, firstName: string) {
        this.dataState = state
        this.seatNumber = seatNumber
        this.studentId = studentId
        this.lastName = lastName
        this.firstName = firstName
    }

    isLocked(): boolean {
        return this.dataState === DataState.LOCKED
    }

    static async decryptPersonalData(crypto: NaClCrypto, userData: User, examName: string, examineeIdentifier: string, examineeEncryptedSubmissions: Map<any, any>) {
        let decryptionKeyPersonalData = userData.getDecryptionKey("personal-data.enc", KeyType.FILE_KEY, examineeIdentifier)
        if (!examineeEncryptedSubmissions.has("personal-data.enc") || typeof examineeEncryptedSubmissions.get("personal-data.enc") !== 'string' || decryptionKeyPersonalData === null) {
            return new ExamineePersonalData(DataState.LOCKED, null, null, null, null)
        }

        if (!examineeEncryptedSubmissions.has('personal-data.enc.sig')) {
            throw new AppError("The signature of the personal data could not be verified.")
        }

        let signature = examineeEncryptedSubmissions.get('personal-data.enc.sig')
        await ExaminationSystemSignature.verifySignature(crypto, examName, examineeIdentifier, "personal-data.enc", examineeEncryptedSubmissions, EXAMINATION_SYSTEM_PUBLIC_KEY_HEX)

        let personalDataString = await crypto.symmetricDecrypt(examineeEncryptedSubmissions.get('personal-data.enc'), decryptionKeyPersonalData)
        let personalDataObject = JSON.parse(personalDataString)

        let personalData = MapHelper.deepMapify(personalDataObject)

        let seatNumber = null;
        if (personalData.has("seat_number")) {
            seatNumber = personalData.get("seat_number")
        }
        let studentId = null;
        if (personalData.has("student_id")) {
            studentId = personalData.get("student_id")
        }
        let firstName = null;
        if (personalData.has("first_name")) {
            firstName = personalData.get("first_name")
        }
        let lastName = null;
        if (personalData.has("last_name")) {
            lastName = personalData.get("last_name")
        }

        return new ExamineePersonalData(DataState.UNLOCKED, seatNumber, studentId, lastName, firstName)
    }
}

export class ExaminationSystemSignature {
    static async verifySignature(crypto: NaClCrypto, examName: string, examineeIdentifier: string, dataName: string, encryptedData: Map<any, any>, validPublicKeysHex: string[]) {
        console.log("Verifying signature for " + dataName + " of examinee " + examineeIdentifier)
        if (!encryptedData.has(dataName)) {
            throw new AppError("Cannot obtain data from encrypted data as the key does not have an associated value.")
        }
        const dataNameSignature = dataName + ".sig"
        if (!encryptedData.has(dataNameSignature)) {
            throw new AppError("Signature verification failed. The encrypted data lacks the needed signature.")
        }
        const signatureMap = encryptedData.get(dataNameSignature)

        if (!signatureMap.has('public_key') || !signatureMap.has('signature')) {
            throw new AppError("Signature verification failed. The provided signature does not match the expected format.")
        }

        const publicKeyHex = signatureMap.get('public_key')

        if (!validPublicKeysHex.includes(publicKeyHex)) {
            throw new AppError("Signature verification failed. Signature public key does not match any expected public key.")
        }

        const signatureHex = signatureMap.get('signature')
        const messageBytes = await crypto.base64ToBytes(encryptedData.get(dataName))
        const prefixEncoder = new TextEncoder()
        const prefixBytes = prefixEncoder.encode(examName + "+" + examineeIdentifier + "+" + dataName + "+")
        const prefixedMessageBytes = new Uint8Array(prefixBytes.length + messageBytes.length)
        prefixedMessageBytes.set(prefixBytes)
        prefixedMessageBytes.set(messageBytes, prefixBytes.length)

        let signatureMatches = await crypto.verifyMessageBytesSignature(prefixedMessageBytes, signatureHex, publicKeyHex)
        if (signatureMatches !== true) {
            throw new AppError("Signature verification failed. Signature is invalid and does not match the original message.")
        }
        return true
    }
}