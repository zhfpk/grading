import {FileMapping} from "@/models/FileMapping";
import {DataState, GradingType, KeyType} from "@/models/Enums";
import {User} from "@/models/User";
import {ExamSubtask, ExamTasksData} from "@/models/ExamTaskData";
import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import NaClCrypto from "@/models/NaClCrypto";
import {EXAMINATION_SYSTEM_PUBLIC_KEY_HEX} from "@/models/ExamApi";
import {ExaminationSystemSignature} from "@/models/ExamineeSubmissions";


/**
 * Stores all the IndividualExamineeGradingPoints for all examinees.
 */
export class ExamineeGradingPoints {
    examineeGradingPointsMap: Map<string, IndividualExamineeGradingPoints>
    validPublicKeys: ValidPublicSigningKeys;

    constructor(validPublicKeys: ValidPublicSigningKeys) {
        this.validPublicKeys = validPublicKeys
        this.examineeGradingPointsMap = new Map<string, IndividualExamineeGradingPoints>()
    }

    hasGradingPointsOf(examineeIdentifier: string): boolean {
        return this.examineeGradingPointsMap.has(examineeIdentifier)
    }

    set(examineeIdentifier: string, examineeGradingPoints: IndividualExamineeGradingPoints) {
        this.examineeGradingPointsMap.set(examineeIdentifier, examineeGradingPoints)
    }

    getGradingsOf(examineeIdentifier: string): IndividualExamineeGradingPoints {
        return this.examineeGradingPointsMap.get(examineeIdentifier)
    }

    getExamineeIdentifiers() {
        return this.examineeGradingPointsMap.keys()
    }
}

/**
 * Stores all the grading points (for all subtask fields) for a given examinee.
 * */
export class IndividualExamineeGradingPoints {
    examineeIdentifier: string;
    gradingPoints: Map<string, GradingPoints>;
    reassessmentResult: ReassessmentResult;
    postExamReviewData: PostExamReviewData;

    constructor(examineeIdentifier: string, gradingPoints: Map<string, GradingPoints>, reassessmentResult: ReassessmentResult, postExamReviewData: PostExamReviewData) {
        this.examineeIdentifier = examineeIdentifier
        this.gradingPoints = gradingPoints
        this.reassessmentResult = reassessmentResult
        this.postExamReviewData = postExamReviewData
    }

    updateGradingPoints(fieldIdentifier: string, gradingInput: GradingInput, gradingType: GradingType): GradingPoints {
        const gradingPointsForSubtaskField: GradingPoints = this.getGradingPointsForSubtaskField(fieldIdentifier)
        if (gradingPointsForSubtaskField === null) {
            throw new AppError("There is no grading points entry for the given subtask field: " + fieldIdentifier)
        }
        gradingPointsForSubtaskField.update(gradingInput, gradingType)
        return gradingPointsForSubtaskField
    }

    getGradingPointsForSubtaskField(subtaskFieldIdentifier: string): GradingPoints {
        let key = subtaskFieldIdentifier + ".points"

        if (!this.gradingPoints.has(key)) {
            return null
        }

        return this.gradingPoints.get(key)
    }

    getSummarizedSubtaskPoints(examTasksData: ExamTasksData, subtaskIdentifier: string): SummarizedSubtaskPoints {
        const summarizedSubtaskPoints: SummarizedSubtaskPoints = new SummarizedSubtaskPoints()

        const examSubtask = examTasksData.getSubtask(subtaskIdentifier)
        if (examSubtask === null) {
            throw new AppError("Could not find subtask with identifier '" + subtaskIdentifier + "' in the exam task data")
        }

        summarizedSubtaskPoints.allPointsLocked = true
        summarizedSubtaskPoints.allGradingsDone = true

        for (let [subtaskFieldIdentifier, gradingPoints] of this.gradingPoints) {
            if (subtaskFieldIdentifier.startsWith(subtaskIdentifier + "_")) {
                if (gradingPoints.isPointsLocked()) {
                    summarizedSubtaskPoints.somePointsLocked = true
                    summarizedSubtaskPoints.allGradingsDone = false
                } else {
                    summarizedSubtaskPoints.allPointsLocked = false
                    if (gradingPoints.isDone()) {
                        summarizedSubtaskPoints.someGradingsDone = true
                        summarizedSubtaskPoints.summarizedPoints += gradingPoints.points
                    } else {
                        summarizedSubtaskPoints.allGradingsDone = false
                    }
                }
                if (gradingPoints.hasAnnotation()) {
                    summarizedSubtaskPoints.withInternalAnnotations = true
                }
            }
        }

        return summarizedSubtaskPoints
    }

    getSummarizedExamPoints(examTasksData: ExamTasksData, gradeCalculation: ExamGradeCalculation = null): SummarizedExamPoints {
        let summarizedExamPoints: SummarizedExamPoints = new SummarizedExamPoints()
        summarizedExamPoints.allPointsLocked = true
        summarizedExamPoints.allGradingsDone = true

        for(let subtask of examTasksData.getSubtasks()) {
            let summarizedSubtaskPoints: SummarizedSubtaskPoints = this.getSummarizedSubtaskPoints(examTasksData, subtask.name)

            if (summarizedSubtaskPoints.somePointsLocked) {
                summarizedExamPoints.somePointsLocked = true
                summarizedExamPoints.allGradingsDone = false
            } else {
                summarizedExamPoints.allPointsLocked = false
                if (summarizedSubtaskPoints.summarizedPoints > subtask.points) {
                    summarizedExamPoints.inconsistentGradings = true
                }
                if (summarizedSubtaskPoints.allGradingsDone) {
                    summarizedExamPoints.possiblePoints += summarizedSubtaskPoints.summarizedPoints
                    summarizedExamPoints.achievedPoints += summarizedSubtaskPoints.summarizedPoints
                } else {
                    summarizedExamPoints.allGradingsDone = false
                    // we add the already achieved points anyway (because k of n subtask fields may already be graded)
                    summarizedExamPoints.achievedPoints += summarizedSubtaskPoints.summarizedPoints
                    summarizedExamPoints.possiblePoints += subtask.points
                }
            }
            if (summarizedSubtaskPoints.withInternalAnnotations) {
                summarizedExamPoints.withInternalAnnotations = true
            }
        }

        if (gradeCalculation !== null) {
            summarizedExamPoints.possiblyPasses = gradeCalculation.isPassed(summarizedExamPoints.possiblePoints)
            summarizedExamPoints.possibleGrade = gradeCalculation.getGrade(summarizedExamPoints.possiblePoints)

            summarizedExamPoints.alreadyPassed = gradeCalculation.isPassed(summarizedExamPoints.achievedPoints)
            summarizedExamPoints.achievedGrade = gradeCalculation.getGrade(summarizedExamPoints.achievedPoints)
        }

        return summarizedExamPoints
    }

    async calculateHashOverGradings(examName: string, includeAnnotations: boolean = false) {
        let stringToHash = ""
        for (let gradingPoints of this.gradingPoints.values()) {
            if (gradingPoints.isPointsLocked() || (includeAnnotations && gradingPoints.isAnnotationLocked())) {
                return null
            }
            stringToHash += gradingPoints.getContentToHash(examName, includeAnnotations) + ";"
        }
        console.log("hashing grading points content of examinee:", stringToHash)

        return (await NaClCrypto.calculateSHA256HexFromString(stringToHash))
    }

    hasInternalGradingAnnotations(): boolean {
        return Array.from(this.gradingPoints.values()).some((gradingPoints: GradingPoints) => !gradingPoints.isAnnotationLocked() && gradingPoints.annotation !== null && gradingPoints.annotation.length > 0);
    }

    hasAnyLockedPoints(): boolean {
        return Array.from(this.gradingPoints.values()).some((gradingPoints: GradingPoints) => gradingPoints.isPointsLocked())
    }

    getReassessmentResult(): ReassessmentResult {
        return this.reassessmentResult
    }

    getPostExamReviewData(): PostExamReviewData {
        return this.postExamReviewData
    }

    static async decryptExamineeGradingPoints(crypto: NaClCrypto, userData: User, examName: string, examineeIdentifier: string, examineeEncryptedGradingPoints: Map<any, any>, validPublicKeys: ValidPublicSigningKeys) {
        if (!examineeEncryptedGradingPoints.has("file-mapping.enc")) {
            throw new AppError("Cannot decrypt examinee grading points without the internal file mapping list")
        }

        let encryptedFileMapping = examineeEncryptedGradingPoints.get("file-mapping.enc")
        let decryptionKeyFileMapping = userData.getDecryptionKey("file-mapping.enc", KeyType.FILE_KEY, examineeIdentifier)
        await ExaminationSystemSignature.verifySignature(crypto, examName, examineeIdentifier, "file-mapping.enc", examineeEncryptedGradingPoints, EXAMINATION_SYSTEM_PUBLIC_KEY_HEX)

        let fileMapping = await FileMapping.decryptFileMapping(encryptedFileMapping, crypto, decryptionKeyFileMapping)

        let decryptedExamineeGradingPoints = new Map<string, GradingPoints>()

        let gradingPointsFiles = fileMapping.getPointsFiles()

        for (const [gradingPointsFile, mappedFileName] of gradingPointsFiles) {
            console.log(gradingPointsFile, mappedFileName, examineeEncryptedGradingPoints.has(mappedFileName))

            if (examineeEncryptedGradingPoints.has(mappedFileName)) {
                // user could download the encrypted grading points data

                // verify the signature
                await ExaminationSystemSignature.verifySignature(crypto, examName, examineeIdentifier, mappedFileName, examineeEncryptedGradingPoints, validPublicKeys.asArray())

                let decryptedGradingPointsJSONString = await crypto.symmetricDecrypt(examineeEncryptedGradingPoints.get(mappedFileName), userData.getDecryptionKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier))
                let decryptedGradingPointsObject = JSON.parse(decryptedGradingPointsJSONString)
                let decryptedGradingPointsMap = MapHelper.deepMapify(decryptedGradingPointsObject)

                let decryptedAnnotation = null
                let decryptedGradingType = null

                let userHasAccessToAnnotation = false
                if (decryptedGradingPointsMap.has("enc-annotation")) {
                    let annotationDecryptionKey = userData.getDecryptionKey(gradingPointsFile + "+annotation", KeyType.AUXILIARY_KEY, examineeIdentifier)
                    if (annotationDecryptionKey !== null) {
                        // user has the key to decrypt the (internal) annotation
                        let decryptedAnnotationJSONString = await crypto.symmetricDecrypt(decryptedGradingPointsMap.get('enc-annotation'), annotationDecryptionKey)
                        decryptedAnnotation = JSON.parse(decryptedAnnotationJSONString)
                        if (decryptedAnnotation !== null && typeof decryptedAnnotation !== 'string') {
                            throw new AppError("Invalid content of grading annotation (the annotation is of an unexpected type)")
                        }
                        userHasAccessToAnnotation = true
                    }
                }

                if (decryptedGradingPointsMap.has("enc-type")) {
                    let gradingTypeDecryptionKey = userData.getDecryptionKey(gradingPointsFile + "+type", KeyType.AUXILIARY_KEY, examineeIdentifier)
                    if (gradingTypeDecryptionKey !== null) {
                        // user has the key to decrypt the (internal) grading type
                        let decryptedGradingTypeJSONString = await crypto.symmetricDecrypt(decryptedGradingPointsMap.get('enc-type'), gradingTypeDecryptionKey)
                        decryptedGradingType = JSON.parse(decryptedGradingTypeJSONString)
                        if (decryptedGradingType !== null && typeof decryptedGradingType !== 'number') {
                            throw new AppError("Invalid content of grading type (the grading type is of an unexpected type)")
                        }
                    }
                }

                let points = decryptedGradingPointsMap.has('points') ? decryptedGradingPointsMap.get('points') : null
                let comment = decryptedGradingPointsMap.has('comment') ? decryptedGradingPointsMap.get('comment') : null

                if (userHasAccessToAnnotation)
                    decryptedExamineeGradingPoints.set(gradingPointsFile, GradingPoints.createDecryptedGradingPointsWithAnnotation(examineeIdentifier, gradingPointsFile, mappedFileName, points, comment, decryptedAnnotation, decryptedGradingType))
                else
                    decryptedExamineeGradingPoints.set(gradingPointsFile, GradingPoints.createDecryptedGradingPoints(examineeIdentifier, gradingPointsFile, mappedFileName, points, comment))
            } else {
                // user could not download the encrypted grading points data
                decryptedExamineeGradingPoints.set(gradingPointsFile, GradingPoints.createLockedGradingPoints(examineeIdentifier, gradingPointsFile, mappedFileName))
            }
        }
        console.log(decryptedExamineeGradingPoints)

        return decryptedExamineeGradingPoints
    }

}

export class GradingPoints {
    examineeIdentifier: string;
    gradingPointsFileName: string;
    mappedFileName: string;
    pointsState: DataState;
    points: number;
    comment: string;
    annotationState: DataState;
    annotation: string;
    gradingTypeState: DataState;
    gradingType: number;


    constructor(examineeIdentifier: string, gradingPointsFileName: string, mappedFileName: string, pointsState: DataState, points: number, comment: string, annotationState: DataState, annotation: string, gradingTypeState: DataState, gradingType: number) {
        if (points !== null && !Number.isInteger(points)) {
            throw new AppError("Points can only be integers (invalid number provided)")
        }
        this.examineeIdentifier = examineeIdentifier
        this.gradingPointsFileName = gradingPointsFileName
        this.mappedFileName = mappedFileName
        this.pointsState = pointsState
        this.points = points
        this.comment = comment
        this.annotationState = annotationState
        this.annotation = annotation
        this.gradingTypeState = gradingTypeState
        this.gradingType = gradingType
    }

    isPointsLocked(): boolean {
        return this.pointsState === DataState.LOCKED
    }

    isAnnotationLocked(): boolean {
        return this.annotationState === DataState.LOCKED
    }

    isGradingTypeLocked(): boolean {
        return this.gradingTypeState === DataState.LOCKED
    }

    isDone(): boolean {
        return !this.isPointsLocked() && this.points !== null
    }

    hasAnnotation(): boolean {
        return !this.isAnnotationLocked() && this.annotation !== null && this.annotation.length > 0
    }

    toInputValue(): string {
        if (this.isPointsLocked() || this.isAnnotationLocked())
            throw new AppError("Cannot generate input string when in locked state")

        return this.toGradingInput().toInputValue()
    }

    toGradingInput(): GradingInput {
        return new GradingInput(this.points, this.comment, this.annotation)
    }

    update(gradingInput: GradingInput, gradingType: GradingType): void {
        if (this.isPointsLocked()) {
            throw new AppError("You do not have sufficient permission to grade the subtask field (as points are locked): " + this.gradingPointsFileName)
        }
        if (this.isAnnotationLocked()) {
            throw new AppError("You do not have sufficient permission to grade the subtask field (as annotation is locked): "  + this.gradingPointsFileName)
        }
        if (this.isGradingTypeLocked()) {
            throw new AppError("You do not have sufficient permission to grade the subtask field (as grading type is locked): " + this.gradingPointsFileName)
        }

        this.points = gradingInput.points
        this.comment = gradingInput.comment
        this.annotation = gradingInput.annotation
        this.gradingType = gradingType
    }

    async encryptAndSign(examName: string, user: User, crypto: NaClCrypto): Promise<Object> {
        if (this.isPointsLocked() || this.isAnnotationLocked() || this.isGradingTypeLocked()) {
            throw new AppError("You do not have sufficient permission to encrypt this grading (points or annotations are locked)")
        }

        let encryptionKeyGradingFile = user.getEncryptionKey(this.mappedFileName, KeyType.FILE_KEY, this.examineeIdentifier)
        let encryptionKeyAnnotation = user.getEncryptionKey(this.gradingPointsFileName + "+annotation", KeyType.AUXILIARY_KEY, this.examineeIdentifier)
        let encryptionKeyGradingType = user.getEncryptionKey(this.gradingPointsFileName + "+type", KeyType.AUXILIARY_KEY, this.examineeIdentifier)

        if (encryptionKeyGradingFile === null)
            throw new AppError("You do not have sufficient permission to encrypt this grading (key for grading file not part of the user's key store)")

        if (encryptionKeyAnnotation === null)
            throw new AppError("You do not have sufficient permission to encrypt this grading (key for annotation is not part of the user's key store)")

        if (encryptionKeyGradingType === null)
            throw new AppError("You do not have sufficient permission to encrypt this grading (key for the grading type is not part of the user's key store)")

        let encryptedAnnotation = await (crypto.symmetricEncrypt(JSON.stringify(this.annotation), encryptionKeyAnnotation))
        let encryptedGradingType = await (crypto.symmetricEncrypt(JSON.stringify(this.gradingType), encryptionKeyGradingType))

        let gradingObjectJSON = JSON.stringify({
            points: this.points,
            comment: this.comment,
            "enc-annotation": encryptedAnnotation,
            "enc-type": encryptedGradingType
        })

        const encryptedGradingPointsBase64 = await (crypto.symmetricEncrypt(gradingObjectJSON, encryptionKeyGradingFile))

        const encryptedGradingPointsBytes = await crypto.base64ToBytes(encryptedGradingPointsBase64)

        const gradingPointsSignatureHex = await (crypto.signMessage(this.getBytesToSign(examName, encryptedGradingPointsBytes)))

        return {
            encryptedGradingPointsBase64: encryptedGradingPointsBase64,
            signatureGradingPointsHex: gradingPointsSignatureHex
        }
    }

    getBytesToSign(examName: string, encryptedGradingPointBytes: Uint8Array): Uint8Array {
        const signaturePrefixString = examName + "+" + this.examineeIdentifier + "+" + this.mappedFileName + "+"
        const encodedSignaturePrefix = new TextEncoder().encode(signaturePrefixString)

        const bytesToSign = new Uint8Array(encodedSignaturePrefix.length + encryptedGradingPointBytes.length)
        bytesToSign.set(encodedSignaturePrefix, 0)
        bytesToSign.set(encryptedGradingPointBytes, encodedSignaturePrefix.length)

        return bytesToSign
    }

    getContentToHash(examName: string, includeAnnotation: boolean = false) {
        if (this.isPointsLocked() || (includeAnnotation && this.isAnnotationLocked()))
            throw new AppError("Cannot hash locked gradings")

        let content = "[" + examName + ";" + this.examineeIdentifier + ";" + this.gradingPointsFileName + ";" + this.mappedFileName + ";" + this.points + ";" + this.comment
        if (includeAnnotation) {
            content += ";" + this.annotation + "]"
        } else {
            content += "]"
        }
        return content
    }

    static createLockedGradingPoints(examineeIdentifier: string, gradingPointsFileName: string, mappedFileName: string) {
        return new GradingPoints(examineeIdentifier, gradingPointsFileName, mappedFileName, DataState.LOCKED, null, null, DataState.LOCKED, null, DataState.LOCKED, null)
    }

    static createDecryptedGradingPoints(examineeIdentifier: string, gradingPointsFileName: string, mappedFileName: string, points: number, comment: string) {
        return new GradingPoints(examineeIdentifier, gradingPointsFileName, mappedFileName, DataState.UNLOCKED, points, comment, DataState.LOCKED, null, DataState.LOCKED, null)
    }

    static createDecryptedGradingPointsWithAnnotation(examineeIdentifier: string, gradingPointsFileName: string, mappedFileName: string, points: number, comment: string, annotation: string, gradingType: number) {
        return new GradingPoints(examineeIdentifier, gradingPointsFileName, mappedFileName, DataState.UNLOCKED, points, comment, DataState.UNLOCKED, annotation, DataState.UNLOCKED, gradingType)
    }

}

export class GradingInput {
    points: number;
    comment: string;
    annotation: string;

    constructor(points: number, comment: string, annotation: string) {
        this.points = points
        this.comment = comment
        this.annotation = annotation
    }

    toInputValue(): string {
        // note: replace any occurrence of \n and \r in case these characters somehow got in here
        const replacementRegex = /(\n|\r)/g
        if (this.points === null) {
            if (this.annotation === null || this.annotation.length === 0) {
                return ""
            } else {
                return "# " + this.annotation.replaceAll(replacementRegex, "")
            }
        }

        let value: string = this.points.toString()
        if (this.comment !== null && this.comment.length > 0)
            value += " " + this.comment

        if (this.annotation !== null && this.annotation.length > 0)
            value += " # " + this.annotation

        value = value.replaceAll(replacementRegex, "")

        return value
    }

    toSummary(verbose: boolean = false): string {
        if (this.points === null) {
            const text: string = "Enter your grading below"
            if (this.annotation !== null)
                return text + " (" + this.annotation + ")"
            else
                return text
        }

        const pointsString = verbose === true ? (this.points == 1 ? "Point" : "Points") : "P"
        let summary: string = this.points.toString() + " " + pointsString
        if (this.comment !== null && this.comment.length > 0)
            summary += ": " + this.comment

        if (this.annotation !== null && this.annotation.length > 0)
            summary += " (" + this.annotation + ")"

        return summary
    }

    static parse(input: string): GradingInput {
        let points = null
        let comment = null
        let annotation = null
        input = input.trim()

        if (input.includes("\n") || input.includes("\r")) {
            throw new AppError("Gradings must be in a single line (and cannot contain \\n or \\r characters)")
        }

        if (input.startsWith("#")) {
            // all input is an internal annotation
            annotation = input.slice(1).trim()
        } else {
            let splitAtWhitespaces = input.split(' ')

            points = Number(splitAtWhitespaces[0])
            if (splitAtWhitespaces[0].length === 0 || !Number.isInteger(points) || points < 0) {
                throw new AppError("Awarded points must be a non-negative integer")
            }

            if (splitAtWhitespaces.length > 1) {
                // there is content after the points (comment AND/OR annotation)

                let remaining = splitAtWhitespaces.slice(1).join(" ")

                let idxLastHashtag = remaining.lastIndexOf("#")
                if (idxLastHashtag === -1) {
                    // there is no annotation
                    comment = remaining.trim()
                } else if (idxLastHashtag === 0) {
                    // there is no comment
                    annotation = remaining.slice(idxLastHashtag+1).trim()
                } else {
                    // there is comment and annotation
                    comment = remaining.slice(0, idxLastHashtag-1).trim()
                    annotation = remaining.slice(idxLastHashtag+1).trim()
                }
            }
        }

        return new GradingInput(points, comment, annotation)
    }

    static isValid(input: string): boolean {
        try {
            GradingInput.parse(input)
            return true
        } catch(e) {
            return false
        }
    }
}

export class SummarizedSubtaskPoints {
    summarizedPoints: number;
    somePointsLocked: boolean;
    allPointsLocked: boolean;
    allGradingsDone: boolean;
    someGradingsDone: boolean;
    withInternalAnnotations: boolean;

    constructor() {
        this.summarizedPoints = 0
        this.somePointsLocked = false
        this.allPointsLocked = false
        this.allGradingsDone = false
        this.someGradingsDone = false
        this.withInternalAnnotations = false
    }

    asDisplayableValue(): string {
        if (this.allPointsLocked || !this.someGradingsDone)
            return "?"
        if (this.allGradingsDone)
            return this.summarizedPoints.toString()
        if (this.somePointsLocked || !this.allGradingsDone)
            return "≥ " + this.summarizedPoints.toString()
    }
}

export class SummarizedExamPoints {
    achievedPoints: number;
    possiblePoints: number;
    allGradingsDone: boolean;
    allPointsLocked: boolean;
    somePointsLocked: boolean;
    inconsistentGradings: boolean;
    achievedGrade: string;
    possibleGrade: string;
    alreadyPassed: boolean;
    possiblyPasses: boolean;
    withInternalAnnotations: boolean;

    constructor() {
        this.achievedPoints = 0
        this.possiblePoints = 0
        this.allGradingsDone = false
        this.somePointsLocked = false
        this.allPointsLocked = false
        this.inconsistentGradings = false
        this.achievedGrade = "?"
        this.possibleGrade = "?"
        this.alreadyPassed = false
        this.possiblyPasses = false
        this.withInternalAnnotations = false
    }
}

export class ExamGradingProgress {
    allGradingsDone: boolean;
    somePointsLocked: boolean;
    inconsistentGradings: boolean;

    constructor() {
        this.allGradingsDone = false
        this.somePointsLocked = false
        this.inconsistentGradings = false
    }
}

export class ReassessmentResult {
    dataState: DataState;
    examineeIdentifier: string;
    answerFilesHashHex: string;
    gradingFilesHashHex: string;
    approved: boolean;
    signatureHex: string;
    publicKeyHex: string;
    isSignatureValid: boolean;

    constructor(state: DataState, examineeIdentifier: string, answerFilesHashHex: string, gradingFilesHashHex: string, approved: boolean, signatureHex: string, isSignatureValid: boolean, publicKeyHex: string) {
        this.dataState = state
        this.examineeIdentifier = examineeIdentifier
        this.answerFilesHashHex = answerFilesHashHex
        this.gradingFilesHashHex = gradingFilesHashHex
        this.approved = approved
        this.signatureHex = signatureHex
        this.publicKeyHex = publicKeyHex
        this.isSignatureValid = isSignatureValid
        console.log("ReassessmentResult", this)
    }

    isApproved(): boolean {
        if (this.isLocked()) {
            throw new AppError("Cannot check whether a reassessment result is approved when the reassessment result is locked")
        }
        return this.approved
    }

    isLocked(): boolean {
        return this.dataState === DataState.LOCKED
    }

    isValid(validPublicKeys: ValidPublicSigningKeys, currentGradingFilesHashHex: string, currentAnswerFilesHashHex: string): boolean {
        if (this.isLocked()) {
            throw new AppError("Cannot check whether a reassessment result is valid when the reassessment result is locked")
        }
        if (validPublicKeys === null) {
            throw new AppError("Cannot validate a reassessment result without access to the valid public keys of the exam")
        }
        return validPublicKeys.isValid(this.publicKeyHex) && this.isSignatureValid && currentAnswerFilesHashHex !== null && currentGradingFilesHashHex !== null && this.answerFilesHashHex === currentAnswerFilesHashHex && this.gradingFilesHashHex === currentGradingFilesHashHex
    }

    isApprovedAndValid(validPublicKeys: ValidPublicSigningKeys, currentGradingFilesHashHex: string, currentAnswerFilesHashHex: string): boolean {
        return this.isApproved() && this.isValid(validPublicKeys, currentGradingFilesHashHex, currentAnswerFilesHashHex)
    }

    async toEncrypted(user: User, crypto: NaClCrypto): Promise<string> {
        if (this.isLocked()) {
            throw new AppError("You do not have sufficient permission to encrypt this reassessment result (the reassessment result is locked)")
        }
        if(!this.isApproved()) {
            throw new AppError("Cannot encrypt non-approved reassessment result")
        }

        let encryptionKeyReassessmentFile = user.getEncryptionKey("reassessment-result.enc", KeyType.FILE_KEY, this.examineeIdentifier)

        if (!encryptionKeyReassessmentFile) {
            throw new AppError("You do not have sufficient permission to encrypt this grading (there is no such key in the user's key store)")
        }

        if (!this.gradingFilesHashHex) {
            throw new AppError("Grading files hash cannot be falsy")
        }

        if (!this.answerFilesHashHex) {
            throw new AppError("Answer files hash cannot be falsy")
        }

        if (!this.signatureHex) {
            throw new AppError("Signature cannot be falsy")
        }

        if (!this.publicKeyHex) {
            throw new AppError("Public key cannot be falsy")
        }

        let reassessmentObjectJSON = JSON.stringify({
            "approved": this.approved,
            "grading-files-hash": this.gradingFilesHashHex,
            "answer-files-hash": this.answerFilesHashHex,
            "signature": this.signatureHex,
            "public-key": this.publicKeyHex
        })

        return await (crypto.symmetricEncrypt(reassessmentObjectJSON, encryptionKeyReassessmentFile))
    }

    static async decryptReassessmentResult(crypto: NaClCrypto, userData: User, examineeIdentifier: string, examineeEncryptedGradingPoints: Map<any, any>, validPublicSigningKeys: ValidPublicSigningKeys): Promise<ReassessmentResult> {
        if (!examineeEncryptedGradingPoints.has("reassessment-result.enc") || !userData.getDecryptionKey('reassessment-result.enc', KeyType.FILE_KEY, examineeIdentifier)) {
            return ReassessmentResult.createLockedReassessmentResult(examineeIdentifier)
        }

        let decryptedReassessmentResultJSONString = await crypto.symmetricDecrypt(examineeEncryptedGradingPoints.get('reassessment-result.enc'), userData.getDecryptionKey('reassessment-result.enc', KeyType.FILE_KEY, examineeIdentifier))
        let decryptedReassessmentResultObject = JSON.parse(decryptedReassessmentResultJSONString)
        let decryptedReassessmentResultMap = MapHelper.deepMapify(decryptedReassessmentResultObject)

        console.log("decryptedReassessmentResultMap for", examineeIdentifier, "=>", decryptedReassessmentResultMap)

        const expectedMapKeys = ['approved', 'grading-files-hash', 'answer-files-hash', 'signature', 'public-key']
        const expectedTypes = ['boolean', 'string', 'string', 'string', 'string']

        for (let i=0; i < expectedMapKeys.length; i++) {
            let expectedMapKey = expectedMapKeys[i]
            let expectedType = expectedTypes[i]
            if (!decryptedReassessmentResultMap.has(expectedMapKey) || typeof decryptedReassessmentResultMap.get(expectedMapKey) !== expectedType) {
                throw new AppError("Parsing the reassessment result failed as the reassessment result map does have the expected format")
            }
        }

        const hashAndPubKeyHexRegex = ValidPublicSigningKeys.PUBLIC_KEY_SIGNING_REGEX
        const signatureHexRegex = /^[0-9a-f]{128}$/i

        let approved = decryptedReassessmentResultMap.get('approved')

        let answerFilesHashHex = decryptedReassessmentResultMap.get('answer-files-hash')
        if (answerFilesHashHex.match(hashAndPubKeyHexRegex) === null) {
            throw new AppError("Parsing the reassessment result failed as the reassessment result's submission files hash is invalid")
        }

        let gradingFilesHashHex = decryptedReassessmentResultMap.get('grading-files-hash')
        if (gradingFilesHashHex.match(hashAndPubKeyHexRegex) === null) {
            throw new AppError("Parsing the reassessment result failed as the reassessment result's gradings files hash is invalid")
        }
        let signatureHex = decryptedReassessmentResultMap.get('signature')
        if (signatureHex.match(signatureHexRegex) === null) {
            throw new AppError("Parsing the reassessment result failed as the reassessment result's signature format is invalid")
        }
        let publicKeyHex = decryptedReassessmentResultMap.get('public-key')
        if (publicKeyHex.match(hashAndPubKeyHexRegex) === null) {
            throw new AppError("Parsing the reassessment result failed as the reassessment result's public key format is invalid")
        }

        let isPublicKeyValid = false
        if (validPublicSigningKeys !== null) {
            isPublicKeyValid = validPublicSigningKeys.isValid(publicKeyHex)
        }

        let messageToVerify: string = ReassessmentResult.getContentToSign(examineeIdentifier, answerFilesHashHex, gradingFilesHashHex, approved)

        let isSignatureValid = isPublicKeyValid && (await crypto.verifyMessageSignature(messageToVerify, signatureHex, publicKeyHex))

        return ReassessmentResult.createDecryptedReassessmentResult(examineeIdentifier, answerFilesHashHex, gradingFilesHashHex, approved, signatureHex, isSignatureValid, publicKeyHex)
    }

    static createLockedReassessmentResult(examineeIdentifier: string) {
        return new ReassessmentResult(DataState.LOCKED, examineeIdentifier, null, null, false, null, false, null)
    }

    static createDecryptedReassessmentResult(examineeIdentifier: string, answerFilesHashHex: string, gradingFilesHashHex: string, approved: boolean, signatureHex: string, isSignatureValid: boolean, publicKeyHex: string) {
        return new ReassessmentResult(DataState.UNLOCKED, examineeIdentifier, answerFilesHashHex, gradingFilesHashHex, approved, signatureHex, isSignatureValid, publicKeyHex)
    }

    static getContentToSign(examineeIdentifier: string, answerFilesHashHex: string, gradingFilesHashHex: string, approved: boolean): string {
        return "[" + examineeIdentifier + ";" + answerFilesHashHex + ";" + gradingFilesHashHex + ";" + approved.toString() + "]"
    }
}

export class ValidPublicSigningKeys {
    static PUBLIC_KEY_SIGNING_REGEX = /^[0-9a-f]{64}$/i

    validPublicKeys: Map<string, string>;

    constructor(validPublicKeys: Map<string, string>) {
        this.validPublicKeys = validPublicKeys
    }

    isValid(publicKeyHex: string): boolean {
        if (publicKeyHex.match(ValidPublicSigningKeys.PUBLIC_KEY_SIGNING_REGEX) === null) {
            return false
        }

        return this.asArray().some(pk => pk === publicKeyHex)
    }

    asArray(): string[] {
        return Array.from(this.validPublicKeys.values())
    }

    static fromJSON(validPublicKeysMap: Map<any, any>): ValidPublicSigningKeys {
        if (!(validPublicKeysMap instanceof Map)) {
            throw new AppError("Cannot parse valid public keys as the response from the API does not match the expected format")
        }

        let validPublicKeys = new Map<string, string>()
        for (let [name, publicKey] of validPublicKeysMap) {
            if (typeof name !== 'string' || name.trim().length == 0) {
                throw new AppError("Cannot parse valid public key entry as the name is invalid")
            }
            if(typeof publicKey !== 'string' || publicKey.match(this.PUBLIC_KEY_SIGNING_REGEX) === null) {
                throw new AppError("Cannot parse valid public key entry as the value for the public key is invalid")
            }

            validPublicKeys.set(name, publicKey)
        }

        return new ValidPublicSigningKeys(validPublicKeys)
    }
}


export class PostExamReviewData {
    examineeIdentifier: string;
    examineeUuid: string;
    examineeMasterKey: string;
    reviewAccessed: boolean;
    isReviewAccessedState: DataState;
    credentialsState: DataState;

    constructor(examineeIdentifier: string, isReviewAccessedState: DataState, isReviewAccessed: boolean, credentialsState: DataState, examineeUuid: string, examineeMasterKey: string) {
        this.examineeIdentifier = examineeIdentifier
        this.isReviewAccessedState = isReviewAccessedState
        this.reviewAccessed = isReviewAccessed
        this.credentialsState = credentialsState
        this.examineeUuid = examineeUuid
        this.examineeMasterKey = examineeMasterKey
    }

    areCredentialsLocked(): boolean {
        return this.credentialsState === DataState.LOCKED
    }

    isReviewAccessedLocked(): boolean {
        return this.isReviewAccessedState === DataState.LOCKED
    }

    isReviewAccessed(): boolean {
        if (this.isReviewAccessedLocked()) {
            throw new AppError("Cannot access whether the review was accessed due to locked data")
        }
        return this.reviewAccessed
    }

    getExamineeUuid(): string {
        if (this.areCredentialsLocked()) {
            throw new AppError("Cannot access examinee's uuid without access to the credentials")
        }
        return this.examineeUuid
    }

    getExamineeMasterKey(): string {
        if (this.areCredentialsLocked()) {
            throw new AppError("Cannot access examinee's master key without access to the credentials")
        }
        return this.examineeMasterKey
    }

    static async decryptPostExamReviewData(crypto: NaClCrypto, userData: User, examineeIdentifier: string, examineeEncryptedGradingPoints: Map<any, any>): Promise<PostExamReviewData> {
        let isReviewAccessed = null
        let uuid = null
        let key = null

        if (examineeEncryptedGradingPoints.has('post-exam-review-accessed')) {
            if (typeof examineeEncryptedGradingPoints.get('post-exam-review-accessed') === 'boolean') {
                isReviewAccessed = examineeEncryptedGradingPoints.get('post-exam-review-accessed')
            } else {
                throw new AppError("Parsing the post exam review data failed due to invalid data in the post exam review accessed field")
            }
        }

        const decryptionKeyReviewCredentials = userData.getDecryptionKey('post-exam-review-credentials.enc', KeyType.FILE_KEY, examineeIdentifier)
        if (examineeEncryptedGradingPoints.has("post-exam-review-credentials.enc") && decryptionKeyReviewCredentials !== null) {
            // attempt to decrypt
            const decryptedReviewCredentials = await crypto.symmetricDecrypt(examineeEncryptedGradingPoints.get('post-exam-review-credentials.enc'), decryptionKeyReviewCredentials)
            const decryptedReviewCredentialsObject = JSON.parse(decryptedReviewCredentials)
            const decryptedReviewCredentialsMap = MapHelper.deepMapify(decryptedReviewCredentialsObject)

            if (!decryptedReviewCredentialsMap.has('uuid') || typeof decryptedReviewCredentialsMap.get('uuid') !== 'string') {
                throw new AppError("Parsing the post exam review data failed as the credentials are missing the required uuid")
            }
            if (!decryptedReviewCredentialsMap.has('key') || typeof decryptedReviewCredentialsMap.get('key') !== 'string') {
                throw new AppError("Parsing the post exam review data failed as the credentials are missing the required key")
            }

            uuid = decryptedReviewCredentialsMap.get('uuid')
            key = decryptedReviewCredentialsMap.get('key')
        }

        if (isReviewAccessed !== null && uuid !== null && key !== null) {
            return PostExamReviewData.createDecryptedPostExamReviewData(examineeIdentifier, isReviewAccessed, uuid, key)
        } else if (isReviewAccessed !== null) {
            return PostExamReviewData.createLockedPostExamReviewDataWithReviewAccess(examineeIdentifier, isReviewAccessed)
        } else {
            return PostExamReviewData.createLockedPostExamReviewData(examineeIdentifier)
        }
    }

    static createDecryptedPostExamReviewData(examineeIdentifier: string, accessed: boolean, uuid: string, key: string) {
        return new PostExamReviewData(examineeIdentifier, DataState.UNLOCKED, accessed, DataState.UNLOCKED, uuid, key)
    }

    static createLockedPostExamReviewDataWithReviewAccess(examineeIdentifier: string, accessed: boolean): PostExamReviewData {
        return new PostExamReviewData(examineeIdentifier, DataState.UNLOCKED, accessed, DataState.LOCKED, null, null)
    }

    static createLockedPostExamReviewData(examineeIdentifier: string): PostExamReviewData {
        return new PostExamReviewData(examineeIdentifier, DataState.LOCKED, null, DataState.LOCKED, null, null)
    }

}