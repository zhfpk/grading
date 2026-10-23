import {
    IndividualExamineeGradingPoints,
    GradingPoints,
    ExamineeGradingPoints,
    ReassessmentResult,
    ValidPublicSigningKeys,
    PostExamReviewData
} from "@/models/ExamineeGradingPoints";
import {Permissions, User, UserKeyStore} from "@/models/User";
import {
    ExaminationSystemSignature,
    ExamineePersonalData,
    IndividualExamineeSubmissions
} from "@/models/ExamineeSubmissions";
import {ExamTasksData} from "@/models/ExamTaskData";
import {ExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {ExamGraders} from "@/models/ExamGrader";
import {ExamUserCreator} from "@/models/ExamUserCreator";
import {FileMapping, FileMappings} from "@/models/FileMapping";
import {KeyType} from "@/models/Enums";
import {MapHelper} from "@/models/MapHelper";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import {AppError} from "@/models/AppError";
import {ExamReviewConfig} from "@/models/ExamReviewConfig";
import NaClCrypto from "@/models/NaClCrypto";
import {RecoveryFile} from "@/models/Exporting";

export default class ExamApi {
    crypto: NaClCrypto;
    userData: User;
    examName: string;
    uuid: string;

    constructor(privateSigningKeyExpected: boolean = true) {
        this.examName = this.#parseExamName()
        this.uuid = this.#parseUuid()

        this.crypto = new NaClCrypto(this.examName, this.uuid, privateSigningKeyExpected)

        this.userData = null
    }

    async getSubmissions(examineeIdentifier = null) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()
            if (examineeIdentifier !== null) {
                urlParameters.set('examineeIdentifier', examineeIdentifier)
            }

            let submissions= new ExamineeSubmissions()

            let response = await fetch('/api/submissions?' + urlParameters.toString())

            if (!response.ok) {
                throw new AppError("Obtaining the examinees' submissions failed as the API's response contained an error")
            }

            let encryptedSubmissionsDataObject = await response.json()

            const encryptedSubmissionsDataMap = MapHelper.deepMapify(encryptedSubmissionsDataObject)

            for (let [examineeIdentifier, examineeMap] of encryptedSubmissionsDataMap.entries()) {
                if (!(examineeMap instanceof Map)) {
                    continue
                }

                if (!(examineeMap.has('anonymized_first_name') && examineeMap.has('anonymized_last_name'))) {
                    continue
                }

                let anonymizedFirstName = examineeMap.get('anonymized_first_name')
                let anonymizedLastName = examineeMap.get('anonymized_last_name')

                console.log("examineeMap", examineeMap)

                let decryptedSubmissionsData = await (IndividualExamineeSubmissions.decryptExamineeSubmissions(this.crypto, await (this.userData), this.examName, examineeIdentifier, examineeMap))

                let decryptedPersonalData = await (ExamineePersonalData.decryptPersonalData(this.crypto, await (this.userData), this.examName, examineeIdentifier, examineeMap))

                const answerFilesHashHex = await IndividualExamineeSubmissions.calculateAnswerFilesHash(examineeIdentifier, decryptedSubmissionsData)
                submissions.set(examineeIdentifier, new IndividualExamineeSubmissions(examineeIdentifier, anonymizedFirstName, anonymizedLastName, decryptedSubmissionsData, decryptedPersonalData, answerFilesHashHex))
            }

            return submissions
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the examinees' submissions failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getGradingPoints(examineeIdentifier = null, includeSignatures = false) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()
            urlParameters.set('signatures', (includeSignatures === true).toString())
            if (examineeIdentifier !== null) {
                urlParameters.set('examineeIdentifier', examineeIdentifier)
            }

            let response = await fetch('/api/points?' + urlParameters.toString())

            if (!response.ok) {
                throw new AppError("Obtaining the examinees' gradings failed as the API's response contained an error")
            }

            let encryptedGradingPointsObject = await response.json()

            let encryptedGradingPointsMap = MapHelper.deepMapify(encryptedGradingPointsObject)

            let validPublicSigningKeys = null
            if (encryptedGradingPointsMap.has('valid-public-keys')) {
                // parse the valid public keys
                validPublicSigningKeys = ValidPublicSigningKeys.fromJSON(encryptedGradingPointsMap.get('valid-public-keys'))
            }

            let gradingPoints = new ExamineeGradingPoints(validPublicSigningKeys)

            for (let [examineeIdentifier, examineeMap] of encryptedGradingPointsMap.entries()) {
                if (!(examineeMap instanceof Map)) {
                    continue
                }
                if (examineeIdentifier === 'valid-public-keys') {
                    continue
                }

                let decryptedGradingPoints = await (IndividualExamineeGradingPoints.decryptExamineeGradingPoints(this.crypto, await (this.userData), this.examName, examineeIdentifier, examineeMap, validPublicSigningKeys))

                let decryptedReassessmentResult = await (ReassessmentResult.decryptReassessmentResult(this.crypto, await (this.userData), examineeIdentifier, examineeMap, validPublicSigningKeys))

                let decryptedPostExamReviewData = await (PostExamReviewData.decryptPostExamReviewData(this.crypto, await (this.userData), examineeIdentifier, examineeMap))

                gradingPoints.set(examineeIdentifier, new IndividualExamineeGradingPoints(examineeIdentifier, decryptedGradingPoints, decryptedReassessmentResult, decryptedPostExamReviewData))
            }

            return gradingPoints
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the examinees' gradings failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getFileMappings() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()
            let fileMappings = new FileMappings()
            let encryptedFileMappingsObject = await (await fetch('/api/filemappings?' + urlParameters.toString())).json()

            let encryptedFileMappingsMap = MapHelper.deepMapify(encryptedFileMappingsObject)

            for (let [examineeIdentifier, examineeMap] of encryptedFileMappingsMap.entries()) {
                if (!(examineeMap instanceof Map)) {
                    continue
                }

                if (examineeMap.has('file-mapping.enc')) {
                    let encryptedFileMapping = examineeMap.get('file-mapping.enc')

                    let decryptionKeyFileMapping = this.userData.getDecryptionKey("file-mapping.enc", KeyType.FILE_KEY, examineeIdentifier)

                    await ExaminationSystemSignature.verifySignature(this.crypto, this.examName, examineeIdentifier, "file-mapping.enc", examineeMap, EXAMINATION_SYSTEM_PUBLIC_KEY_HEX)

                    let decryptedFileMapping = await FileMapping.decryptFileMapping(encryptedFileMapping, this.crypto, decryptionKeyFileMapping)
                    fileMappings.setMapping(examineeIdentifier, decryptedFileMapping)
                }
            }

            return fileMappings
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the examinees' internal file mappings failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getTasksData() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()

            let examTasksDataObject = await (await fetch('/api/tasksdata?' + urlParameters.toString())).json()

            return ExamTasksData.fromJSON(examTasksDataObject)
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the task data failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getExamPhase() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()

            let response = await fetch('/api/examphase?' + urlParameters.toString())

            if (!response.ok) {
                if (response.status === 403) {
                    throw new AppError("Obtaining the exam phase failed due to insufficient permissions")
                }
            }

            let examPhaseObject = await response.json()

            const validPhases = ["grading", "reassessment", "review"]

            if (typeof examPhaseObject !== "string" || !validPhases.includes(examPhaseObject)) {
                throw new AppError("Obtaining the exam phase failed due to an unexpected retrieved exam phase")
            }

            return examPhaseObject
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the exam phase failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async setExamPhase(examPhase: string) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (examPhase === null || typeof examPhase !== 'string' || examPhase.trim().length <= 0) {
            throw new AppError("Cannot set exam phase to invalid value")
        }

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const serverResponse = await fetch('/api/examphase?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    'exam_phase': examPhase.trim()
                })
            })
            if (!serverResponse.ok) {
                if (serverResponse.status === 403) {
                    throw new AppError("Changing the exam phase failed due to insufficient permissions")
                } else if (serverResponse.status === 400) {
                    throw new AppError("Changing the exam phase failed due to invalid request content (server rejected the request)")
                } else if (serverResponse.status === 413) {
                    throw new AppError("Changing the exam phase failed due to too long request content (server rejected the request)")
                } else if (serverResponse.status === 500) {
                    throw new AppError("Changing the exam phase failed due to an internal server error")
                } else {
                    throw new AppError("Changing the exam phase failed due to an unexpected error")
                }
            }
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Changing the exam phase failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }

        return examPhase.trim()
    }

    async getExamGradeCalculation() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()

            let examGradeCalculationJSON = await (await fetch('/api/gradecalculation?' + urlParameters.toString())).json()

            return ExamGradeCalculation.fromJSON(examGradeCalculationJSON)
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the exam's grade calculation details failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async saveExamGradeCalculation(gradeLimits: Map<string, number>) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const response = await fetch('/api/gradecalculation?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "grade_limits": gradeLimits
                })
            })

            if (!response.ok) {
                if (response.status === 403) {
                    throw new AppError("Insufficient permission: You cannot change the required points for the grade calculation")
                } else if (response.status === 400) {
                    throw new AppError("Updating the grade calculation failed as the server rejected the request due to invalid data")
                } else {
                    throw new AppError("Updating the grade calculation failed due to an internal server error")
                }
            }

            return response.status
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Changing the exam's grade calculation failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getReviewConfig() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()

            let response = await fetch('/api/reviewconfig?' + urlParameters.toString())

            if (!response.ok) {
                if (response.status === 403) {
                    throw new AppError("Obtaining the review config failed due to insufficient permissions")
                }
            }

            let reviewConfigJson = await response.json()

            return ExamReviewConfig.fromJSON(reviewConfigJson)
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the review config failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async setReviewConfig(timeframeFrom: string, timeframeUntil: string) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (timeframeFrom === null || typeof timeframeFrom !== 'string' || timeframeFrom.trim().length <= 0) {
            throw new AppError("Cannot set the review timeframe")
        }

        if (timeframeUntil === null || typeof timeframeUntil !== 'string' || timeframeUntil.trim().length <= 0) {
            throw new AppError("Cannot set the review timeframe")
        }

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const serverResponse = await fetch('/api/reviewconfig?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    'timeframe_until': timeframeUntil,
                    "timeframe_from": timeframeFrom
                })
            })
            if (!serverResponse.ok) {
                if (serverResponse.status === 403) {
                    throw new AppError("Changing the exam review config failed due to insufficient permissions")
                } else if (serverResponse.status === 400) {
                    throw new AppError("Changing the exam review config failed due to invalid request content (server rejected the request)")
                } else if (serverResponse.status === 500) {
                    throw new AppError("Changing the exam review config failed due to an internal server error")
                } else {
                    throw new AppError("Changing the exam review config failed due to an unexpected error")
                }
            }
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Changing the exam phase failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async getExamGraders() {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        try {
            let urlParameters = this.#getDefaultQueryParameters()

            let examGradersJSON = await (await fetch('/api/examgraders?' + urlParameters.toString())).json()
            return (await ExamGraders.fromPartiallyEncryptedJSON(examGradersJSON, this.crypto, (await this.userData)))
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Obtaining the exam's graders failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async createExamGraderUser(graderRealName: string, graderPermissions: Array<string>) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (graderPermissions.length === 0) {
            throw new AppError("Cannot create exam grader without any permissions")
        }

        if (graderRealName.trim().length === 0) {
            throw new AppError("Cannot create exam grader with an empty name")
        }

        const fileMappings: FileMappings = await this.getFileMappings()

        const examUserCreator = new ExamUserCreator(await this.userData, this.crypto, fileMappings)

        const createdUser = await examUserCreator.createExamGrader(graderRealName, graderPermissions)

        let urlParameters = this.#getDefaultQueryParameters()

        const createdUserRequestBody = await createdUser.craftRequestBodyData(this.crypto)

        console.log("createdUser", createdUser)

        try {
            const serverResponse = await fetch('/api/addgrader?' + urlParameters.toString(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(createdUserRequestBody)
            })

            if (!serverResponse.ok) {
                if (serverResponse.status === 403) {
                    throw new AppError("Creating the exam grader failed due to insufficient permission")
                } else if (serverResponse.status === 400) {
                    throw new AppError("Creating the exam grader failed due to invalid request content (server rejected the request)")
                } else if (serverResponse.status === 413) {
                    throw new AppError("Creating the exam grader failed due to too long request content (server rejected the request)")
                } else if (serverResponse.status === 500) {
                    throw new AppError("Creating the exam grader failed due to an internal server error")
                } else {
                    throw new AppError("Creating the exam grader failed due to an unexpected error")
                }
            }

        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Creating the exam grader failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }

        return createdUser
    }

    async deleteExamGraderUser(examUserName: string) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (examUserName === null || examUserName.length === 0) {
            throw new AppError("Deleting the exam grader failed due to providing an invalid grader name")
        }

        let urlParameters = this.#getDefaultQueryParameters()

        const apiEndpoint = '/api/deletegrader?'

        try {
            const serverResponse = await fetch(apiEndpoint + urlParameters.toString(), {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "grader_name": examUserName
                })
            })

            if (!serverResponse.ok) {
                if (serverResponse.status === 403) {
                    throw new AppError("Deleting the exam grader failed due to insufficient permission")
                } else if (serverResponse.status === 404) {
                    throw new AppError("Deleting the exam grader failed as there is no such grader with the provided name")
                } else if (serverResponse.status === 400) {
                    throw new AppError("Deleting the exam grader failed due to invalid request content")
                } else if (serverResponse.status === 500) {
                    throw new AppError("Deleting the exam grader failed due to an internal server error")
                } else {
                    throw new AppError("Deleting the exam grader failed due to an unexpected error")
                }
            }
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Deleting the exam grader failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async saveGradingPoints(...gradingPointsList: GradingPoints[]) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (gradingPointsList === null || gradingPointsList.length === 0)
            throw new AppError("Saving the gradings failed (non-existing grading provided)")

        let savableGradingPointList = []
        for (let gradingPoints of gradingPointsList) {
            const { encryptedGradingPointsBase64, signatureGradingPointsHex } = await gradingPoints.encryptAndSign(this.examName, this.userData, this.crypto)

            savableGradingPointList.push({
                grading: encryptedGradingPointsBase64,
                signature: signatureGradingPointsHex,
                file: gradingPoints.mappedFileName,
                examinee: gradingPoints.examineeIdentifier
            })
        }

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const response = await fetch('/api/grade?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "gradings": savableGradingPointList
                })
            })

            if (!response.ok) {
                if (response.status === 403) {
                    throw new AppError("Saving the gradings failed due to insufficient permissions")
                } else if (response.status === 400) {
                    throw new AppError("Saving the gradings failed due to invalid request data (server rejected the request)")
                } else if (response.status === 500) {
                    throw new AppError("Saving the gradings failed due to an internal server error")
                }
            }

            return {
                status: response.status,
                content: response.status === 207 ? await response.json() : ""
            }
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Saving the gradings failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async saveReassessmentResult(...reassessmentResultList: ReassessmentResult[]) {
        if (this.userData === null)
            throw new AppError("Initialization needed")

        if (reassessmentResultList === null || reassessmentResultList.length === 0)
            throw new AppError("Saving reassessment results failed (cannot save non-existing or empty reassessment result)")

        let savableReassessmentsList = []
        for (let reassessmentResult of reassessmentResultList) {

            // force this to true
            reassessmentResult.approved = true

            const contentToSign = ReassessmentResult.getContentToSign(reassessmentResult.examineeIdentifier, reassessmentResult.answerFilesHashHex, reassessmentResult.gradingFilesHashHex, reassessmentResult.approved)
            reassessmentResult.signatureHex = await this.crypto.signString(contentToSign)
            reassessmentResult.publicKeyHex = this.userData.publicSigningKey

            const encryptedReassessmentResultBase64 = await reassessmentResult.toEncrypted(this.userData, this.crypto)

            savableReassessmentsList.push({
                reassessment: encryptedReassessmentResultBase64,
                examinee: reassessmentResult.examineeIdentifier
            })
        }

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const response = await fetch('/api/reassessment?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "reassessments": savableReassessmentsList
                })
            })

            if (!response.ok) {
                if (response.status === 403) {
                    throw new AppError("Saving the reassessment result failed due to insufficient permissions")
                } else if (response.status === 400) {
                    throw new AppError("Saving the reassessment result failed due to invalid request content (server rejected the request)")
                } else {
                    throw new AppError("Saving the reassessment result failed due to an unexpected error")
                }
            }

            return response.status
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Saving the reassessment result failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    buildDocumentationURL() {
        let urlParameters = this.#getDefaultQueryParameters()

        return "/documentation?" + urlParameters.toString()
    }

    buildIndividualGradingURL(examineeIdentifier: string) {
        let urlParameters = this.#getDefaultQueryParameters()

        if (!this.#isSafeQueryParameter(examineeIdentifier)) {
            throw new AppError("Unsafe examinee identifier given")
        }

        urlParameters.set('examinee', examineeIdentifier)

        return "/grading/individual?" + urlParameters.toString()
    }

    buildGroupGradingURL(subtaskFieldIdentifier: string) {
        let urlParameters = this.#getDefaultQueryParameters()

        if (!this.#isSafeQueryParameter(subtaskFieldIdentifier)) {
            throw new AppError("Unsafe subtask field identifier given")
        }

        urlParameters.set('identifier', subtaskFieldIdentifier)

        return "/grading/field?" + urlParameters.toString()
    }

    buildGraderInvitationURL(uuid: string, masterKeyHex: string) {
        // create the invite URL from the current location (has hostname, etc.)
        const currentLocation = new URL(window.location.toString())

        if (!this.#isSafeQueryParameter(uuid)) {
            throw new AppError("Unsafe uuid parameter given")
        }

        if (!NaClCrypto.isValidKeyString(masterKeyHex, false)) {
            throw new AppError("Invalid format for given master key")
        }

        currentLocation.pathname = '/grading/invite'
        currentLocation.search = new URLSearchParams({
            exam: this.examName,
            uuid: uuid
        }).toString()

        currentLocation.hash = masterKeyHex

        return currentLocation.toString()
    }

    buildPostExamReviewInviteURL(examineeIdentifier: string, uuid: string, masterKeyHex: string) {
        // create the invite URL from the current location (has hostname, etc.)
        const currentLocation = new URL(window.location.toString())

        if (!this.#isSafeQueryParameter(examineeIdentifier) || !this.#isSafeQueryParameter(uuid)) {
            throw new AppError("Unsafe parameters for URL given")
        }

        if (!NaClCrypto.isValidKeyString(masterKeyHex, false)) {
            throw new AppError("Invalid format for given master key")
        }

        currentLocation.pathname = '/review/invite'
        currentLocation.search = new URLSearchParams({
            exam: this.examName,
            examinee: examineeIdentifier,
            uuid: uuid
        }).toString()

        currentLocation.hash = masterKeyHex

        return currentLocation.toString()
    }

    redirectTo(endpoint: string, includeFragment: boolean = false, includeUuid: boolean = false, additionalQueryParameters: Map<string, string> = null) {
        const queryParameters = this.#getDefaultQueryParameters()

        if (includeUuid !== true) {
            queryParameters.delete("uuid")
        }

        if (additionalQueryParameters !== null) {
            additionalQueryParameters.forEach((value, key) => {
                if (this.#isSafeQueryParameter(key) && this.#isSafeQueryParameter(value)) {
                    queryParameters.set(key, value)
                }
            })
        }

        if (endpoint.indexOf("?") !== -1) {
            throw new AppError("Endpoint used for redirect cannot contain query parameters")
        }

        if (endpoint.indexOf("#") !== -1) {
            throw new AppError("Endpoint used for redirect cannot contain a fragment")
        }

        let target = endpoint + "?" + queryParameters.toString()
        if (includeFragment === true) {
            target += this.crypto.buildKeyFragment()
        }
        window.location.replace(target)
    }

    async generateSigningKeys() {
        const keyPair = await this.crypto.generateSigningKeyPair()

        console.log("generatedSigningKeyPair", keyPair)

        this.crypto.privateSigningKey = keyPair.privateKey
        console.log("private signing key is", keyPair.privateKey.length)
        this.crypto.exportKeysToFragment()
        return keyPair
    }

    async uploadPublicSigningKey(publicSigningKeyHex: string) {
        console.log("Uploading public signing key", publicSigningKeyHex, "for user", this.uuid)

        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const challengeResponse = await fetch('/api/pk?' + urlParameters.toString(), {
                method: "GET"
            })
            const challengeJson = await challengeResponse.json()
            if (!Object.prototype.hasOwnProperty.call(challengeJson,'challenge')) {
                throw new AppError("Unexpected answer from server when trying to retrieve the challenge")
            }
            const challengeToSolve = challengeJson.challenge
            const solvedChallenge = await this.crypto.signString(challengeToSolve)

            const response = await fetch('/api/pk?' + urlParameters.toString(), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    public_signing_key: publicSigningKeyHex,
                    solved_challenge: solvedChallenge
                })
            })

            if (!response.ok) {
                if (response.status === 400) {
                    throw new AppError("The provided public key does not match the expected format")
                } else if (response.status === 401) {
                    throw new AppError("There is an error in verifying the response to the challenge provided by the server. Please try again by opening the invitation link.")
                } else if (response.status === 403) {
                    throw new AppError("This invitation link was already used by someone. If this wasn't you, there is a potential security breach. Contact the person that gave you this link.")
                } else {
                    throw new AppError("Saving the reassessment result failed due to an unexpected error")
                }
            }

            return response.status
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Uploading this exam user's public key failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }
    }

    async verifyPrivateKeyAndDownloadedPublicKeyMatch() {
        // tests whether the public key stored on the server for this user matches the private key (mainly for error handling, not a security feature)
        let message = await NaClCrypto.getRandomBytesHex(128)
        let signatureHex = await this.crypto.signString(message)
        console.log("downloaded public key", this.userData.publicSigningKey)
        let matches = await this.crypto.verifyMessageSignature(message, signatureHex, this.userData.publicSigningKey)
        return matches === true
    }

    userHasPermission(permission: string): boolean {
        if (this.userData === null) {
            return false
        }

        return this.userData.permissions.hasPermission(permission)
    }

    getRecoveryFile(): RecoveryFile {
        const {privateSigningKey, masterDecryptionPrivateKey} = this.crypto.getKeys()
        return new RecoveryFile(this.examName, this.uuid, masterDecryptionPrivateKey, privateSigningKey)
    }

    async initialize(){
        let urlParameters = this.#getDefaultQueryParameters()

        try {
            const serverResponse = await fetch('/api/myself?' + urlParameters.toString())
            if (!serverResponse.ok) {
                if (serverResponse.status === 403) {
                    throw new AppError("Access denied")
                }
                throw new AppError("Unhandled error occurred")
            }

            const responseJSON = await (serverResponse).json()
            const responseMap = MapHelper.deepMapify(responseJSON)

            if (!responseMap.has('pseudonym') || typeof responseMap.get('pseudonym') !== 'string') {
                throw new AppError("Invalid pseudonym (for user) in response from API")
            }

            if (!responseMap.has('permissions') || !Array.isArray(responseMap.get('permissions'))) {
                throw new AppError("Invalid permissions in response from API")
            }
            let permissions = Permissions.fromArray(responseMap.get('permissions'))

            if (!responseMap.has('keys') || typeof responseMap.get('keys') !== 'string') {
                throw new AppError("Invalid encrypted key data in response from API")
            }
            let decryptedKeysString = await (this.crypto.asymmetricDecrypt(responseMap.get('keys'), this.crypto.masterDecryptionPrivateKey))
            let keyStore = UserKeyStore.fromJSON(JSON.parse(decryptedKeysString))

            let publicSigningKey = null
            if (responseMap.has('public_signing_key') && typeof responseMap.get('public_signing_key') === 'string') {
                publicSigningKey = responseMap.get('public_signing_key')
            }

            if (!responseMap.has('encrypted_name')) {
                throw new AppError("Invalid encrypted name (for user) in response from API")
            }

            let realName = null
            if (typeof responseMap.get('encrypted_name') === 'string') {
                // we can attempt to decrypt it, otherwise it is invalid and we will ignore it
                realName = await (this.crypto.asymmetricDecrypt(responseMap.get('encrypted_name'), this.crypto.masterDecryptionPrivateKey))
            }

            this.userData = new User(permissions, keyStore, publicSigningKey, responseMap.get('pseudonym'), realName)
        } catch (error) {
            if (error instanceof AppError) {
                throw error
            } else {
                console.error(error)
                throw new AppError("Initialization failed due to an API error. Reload the page, and if the issue persists, contact support.")
            }
        }

    }

    #parseExamName(): string {
        const queryParameters = getQueryParameters()
        if (queryParameters.has("exam")) {
            let examName = queryParameters.get('exam')
            const examNamePattern = /^[0-9a-z-]+$/i
            if (typeof examName !== 'string' || examName.match(examNamePattern) === null) {
                throw new AppError("Invalid exam name given. Did you open the correct URL?")
            }
            return examName
        } else {
            throw new AppError("No exam name given. Did you open the correct URL?")
        }
    }

    #parseUuid(): string {
        const queryParameters = getQueryParameters()
        const cookies = getCookies()
        const uuidPattern = /^[0-9a-f]{64}$/i
        if (queryParameters.has("uuid")) {
            // take the UUID from the query parameters (if any)
            let uuid = queryParameters.get('uuid')
            if (typeof uuid !== 'string' || uuid.length === 0 || uuid.match(uuidPattern) === null) {
                throw new AppError('Invalid uuid detected (query). Did you open the correct URL? To recover from this error, open the saved "Welcome" page for this exam.')
            }
            return uuid
        } else if (cookies.has('uuid')) {
            // take the UUID from the cookies (if any)
            let uuid = cookies.get('uuid')
            if (typeof uuid !== 'string' || uuid.length === 0 || uuid.match(uuidPattern) === null) {
                throw new AppError('Invalid uuid detected (cookie). Did you open the correct URL? To recover from this error, open the saved "Welcome" page for this exam.')
            }
            return uuid
        } else {
            throw new AppError('No uuid detected. Did you open the correct URL? To recover from this error, open the saved "Welcome" page for this exam.')
        }
    }

    #getDefaultQueryParameters() {
        if (!this.#isSafeQueryParameter(this.examName)) {
            throw new AppError("Unsafe query parameter for exam name")
        }

        const params = new URLSearchParams({
            exam: this.examName
        })

        // when the uuid is present in the query parameters, set it for subsequent requests
        const queryParams = getQueryParameters()
        if (queryParams.has('uuid')) {
            let queryUuid = queryParams.get('uuid')
            if (!this.#isSafeQueryParameter(queryUuid)) {
                throw new AppError("Unsafe query parameter for uuid")
            }
            params.set('uuid', queryUuid)
        }

        return params
    }

    #isSafeQueryParameter(parameter: string) {
        return (typeof parameter === 'string' && parameter.length > 0 && parameter.match(/^([0-9a-z\-_])*$/i))
    }
}


export function getQueryParameters(): Map<string, string> {
    const queryString = window.location.search.slice(1)
    const keyValuePairs = queryString.split("&")

    const parameters = new Map<string, string>()
    for (let i = 0; i < keyValuePairs.length; i++) {
        let [key, value] = keyValuePairs[i].split("=")
        parameters.set(key, decodeURIComponent(value))
    }
    return parameters
}


export function getCookies(): Map<string, string> {
    const cookiesMap = new Map<string, string>();

    if (!document.cookie) return cookiesMap;

    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
        const [rawKey, ...rawValParts] = cookie.split('=');

        if (!rawKey || rawValParts.length === 0) {
            continue;
        }

        const key = rawKey.trim();
        const value = decodeURIComponent(rawValParts.join('='));

        cookiesMap.set(key, value);
    }

    return cookiesMap;
}

// hard-coded public key for verifying the signatures on submissions and other examinee data (never used for gradings)
export const EXAMINATION_SYSTEM_PUBLIC_KEY_HEX = ["0fb8331fce82ded5540346184e3e906c7eb60d2631df41055995550a4dc35665"]