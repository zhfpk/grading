import {User, UserKeyStore, KeyGroup} from "@/models/User";
import {FileMappings} from "@/models/FileMapping";
import {KeyType} from "@/models/Enums";
import NaClCrypto from "@/models/NaClCrypto";

export class ExamUserCreator {
    sourceUser: User;
    crypto: NaClCrypto;
    fileMappings: FileMappings;

    constructor(sourceUser: User, crypto: NaClCrypto, fileMappings: FileMappings) {
        this.sourceUser = sourceUser
        this.fileMappings = fileMappings
        this.crypto = crypto
    }

    async createExamGrader(graderRealName: string, graderPermissions: Array<string>): Promise<CreatedUser> {
        const freshKeyStore = new UserKeyStore(new Map<string, KeyGroup>())

        // Creating the key store for the new user based on the keys, the source user knows
        // (note: a source user naturally CANNOT give any keys to a new user that he does not have -> the new user cannot have access to decrypted data where the source user does not)
        // todo: in this branch, we check for "*" permissions, hence, it is an "all or nothing" (no restrictions regarding examinees or submission files possible)
        for (let examineeIdentifier of this.sourceUser.keyStore.getAvailableExamineeIdentifiers()) {

            const examineesFileMapping = this.fileMappings.getMapping(examineeIdentifier)
            let fileMappingNeeded = false

            if (graderPermissions.includes("download-submission:*:*")) {
                fileMappingNeeded = true

                let submissionFilesWithoutPersonalData = examineesFileMapping.getSubmissionFilesWithoutPersonalData()
                for (let [originalFileName, mappedFileName] of submissionFilesWithoutPersonalData.entries()) {
                    let associatedKey = this.sourceUser.getDecryptionKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier)
                    if (associatedKey !== null) {
                        freshKeyStore.addKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier, associatedKey)
                    }
                }
            }

            if (graderPermissions.includes("download-examinee-data:personal-data:*")) {
                // grader has permission to access personal data, hence, also allow submission files with personal data

                fileMappingNeeded = true

                let personalDataKey = this.sourceUser.getDecryptionKey("personal-data.enc", KeyType.FILE_KEY, examineeIdentifier)
                if (personalDataKey !== null) {
                    freshKeyStore.addKey("personal-data.enc", KeyType.FILE_KEY, examineeIdentifier, personalDataKey)
                }

                let submissionFilesContainingPersonalData = examineesFileMapping.getSubmissionFilesContainingPersonalData()
                for (let [originalFileName, mappedFileName] of submissionFilesContainingPersonalData.entries()) {
                    let associatedKey = this.sourceUser.getDecryptionKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier)
                    if (associatedKey !== null) {
                        freshKeyStore.addKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier, associatedKey)
                    }
                }
            }

            if (graderPermissions.includes("download-grading-points:*:*")) {
                // grader has permission to download the grading points => add the keys for them

                fileMappingNeeded = true

                let pointsFiles = examineesFileMapping.getPointsFiles()
                for (let [originalFileName, mappedFileName] of pointsFiles.entries()) {
                    let associatedKey = this.sourceUser.getDecryptionKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier)
                    if (associatedKey !== null) {
                        freshKeyStore.addKey(mappedFileName, KeyType.FILE_KEY, examineeIdentifier, associatedKey)
                    }

                    // every grader gets access to the internal grading annotations
                    let matchingAuxiliaryKeys = this.sourceUser.keyStore.getMatchingKeys(originalFileName + "+", KeyType.AUXILIARY_KEY, examineeIdentifier)
                    if (matchingAuxiliaryKeys !== null) {
                        freshKeyStore.addKeys(matchingAuxiliaryKeys, KeyType.AUXILIARY_KEY, examineeIdentifier)
                    }
                }
            }

            if (graderPermissions.includes("download-examinee-data:reassessment-result:*")) {
                // grader has permission to download the reassessment result => add the key for the file

                let reassessmentResultKey = this.sourceUser.getDecryptionKey("reassessment-result.enc", KeyType.FILE_KEY, examineeIdentifier)
                if (reassessmentResultKey !== null) {
                    freshKeyStore.addKey("reassessment-result.enc", KeyType.FILE_KEY, examineeIdentifier, reassessmentResultKey)
                }
            }

            if (graderPermissions.includes("download-examinee-data:post-exam-review-credentials:*")) {
                // grader has permission to download the post exam review credentials => add the key for the file

                let postExamReviewCredentialsKey = this.sourceUser.getDecryptionKey("post-exam-review-credentials.enc", KeyType.FILE_KEY, examineeIdentifier)
                if (postExamReviewCredentialsKey !== null) {
                    freshKeyStore.addKey("post-exam-review-credentials.enc", KeyType.FILE_KEY, examineeIdentifier, postExamReviewCredentialsKey)
                }
            }

            if (fileMappingNeeded) {
                let fileMappingKey = this.sourceUser.getDecryptionKey("file-mapping.enc", KeyType.FILE_KEY, examineeIdentifier)
                if (fileMappingKey !== null) {
                    // add file mapping key
                    freshKeyStore.addKey("file-mapping.enc", KeyType.FILE_KEY, examineeIdentifier, fileMappingKey)
                }
            }
        }

        if (graderPermissions.includes('"download-exam-data:exam-graders-personal-data"')) {
            // note: pass on the key
            let otherGraderPersonalDataKey = this.sourceUser.getDecryptionKey("other-grader-personal-data", KeyType.AUXILIARY_KEY, "exam")
            freshKeyStore.addKey("other-grader-personal-data", KeyType.AUXILIARY_KEY, "exam", otherGraderPersonalDataKey)
        }

        let otherGraderPersonalDataKey = this.sourceUser.getEncryptionKey("other-grader-personal-data", KeyType.AUXILIARY_KEY, "exam")
        let encryptedNameOthers = await this.crypto.symmetricEncrypt(graderRealName, otherGraderPersonalDataKey)

        const {privateKey, publicKey} = await this.crypto.generateMasterEncryptionKeyPair()
        const uuid = await NaClCrypto.getRandomBytesHex(32)

        let encryptedNameSelf = await this.crypto.asymmetricEncrypt(graderRealName, publicKey)

        return new CreatedUser(uuid, encryptedNameSelf, encryptedNameOthers, graderPermissions, freshKeyStore, privateKey, publicKey)
    }
}


export class CreatedUser {
    permissionsList: Array<string>;
    keyStore: UserKeyStore;
    masterEncryptionPrivateKeyHex: string;
    masterEncryptionPublicKeyHex: string;
    encryptedNameSelf: string;
    encryptedNameOthers: string;
    uuid: string;

    constructor(uuid: string, encryptedNameSelf: string, encryptedNameOthers: string, permissionsList: Array<string>, keyStore: UserKeyStore, masterEncryptionPrivateKeyHex: string, masterEncryptionPublicKeyHex: string) {
        this.uuid = uuid
        this.encryptedNameSelf = encryptedNameSelf
        this.encryptedNameOthers = encryptedNameOthers
        this.permissionsList = permissionsList
        this.keyStore = keyStore
        this.masterEncryptionPrivateKeyHex = masterEncryptionPrivateKeyHex
        this.masterEncryptionPublicKeyHex = masterEncryptionPublicKeyHex
        console.log("CreatedUser", this)
    }

    async craftRequestBodyData(crypto: NaClCrypto): Promise<Object> {
        const encryptedKeyStore = await crypto.asymmetricEncrypt(this.keyStore.toJSON(), this.masterEncryptionPublicKeyHex)

        return {
            "uuid": this.uuid,
            "permissions": this.permissionsList,
            "encrypted_key_store": encryptedKeyStore,
            "encrypted_name_others": this.encryptedNameOthers,
            "encrypted_name_self": this.encryptedNameSelf,
            "master_encryption_public_key_hex": this.masterEncryptionPublicKeyHex,

        }
    }


}