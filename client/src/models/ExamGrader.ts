import {Permission, Permissions, User} from "@/models/User";
import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";
import NaClCrypto from "@/models/NaClCrypto";
import {KeyType} from "@/models/Enums";
import ExamApi from "@/models/ExamApi";

export class ExamGraders {
    graders: Array<ExamGrader>;

    constructor(graders: Array<ExamGrader>) {
        this.graders = graders
        console.log("ExamGraders", this.graders)
    }

    static async fromPartiallyEncryptedJSON(jsonObject: Object, crypto: NaClCrypto, userData: User): Promise<ExamGraders> {
        if (Array.isArray(jsonObject)) {
            // note: should be secure against injections in the JSON because it has to be an Array
            const graders = new Array<ExamGrader>()
            for (let graderObject of jsonObject) {
                const grader = await ExamGrader.fromPartiallyEncryptedJSON(graderObject, crypto, userData)
                graders.push(grader)
            }
            return new ExamGraders(graders)
        } else {
            throw new AppError("There was an error in parsing the exam graders' data from the API. The format of the retrieved data did not match the expected format.")
        }
    }
}


export class ExamGrader {
    pseudonym: string;
    realName: string;
    permissions: Permissions;
    state: string;
    self: boolean;

    constructor(pseudonym: string, realName: string, permissions: Permissions, state: string, self: boolean) {
        this.pseudonym = pseudonym
        this.realName = realName
        this.permissions = permissions
        this.state = state
        this.self = self
    }

    hasPermission(permission: string): boolean {
        return this.permissions.hasPermission(permission)
    }

    isRealNameAccessible(): boolean {
        return this.realName !== null
    }

    static async fromPartiallyEncryptedJSON(rawJsonObject: Object, crypto: NaClCrypto, userData: User): Promise<ExamGrader> {
        const examGraderMap = MapHelper.deepMapify(rawJsonObject)

        let pseudonym;
        if (examGraderMap.has('pseudonym') && typeof examGraderMap.get('pseudonym') === 'string') {
            pseudonym = examGraderMap.get('pseudonym')
        } else {
            throw new AppError("Parsing the exam grader entry failed. Invalid JSON format (field pseudonym is invalid)")
        }

        let state;
        if (examGraderMap.has('state') && typeof examGraderMap.get('state') === 'string') {
            state = examGraderMap.get('state')
        } else {
            throw new AppError("Parsing the exam grader entry failed. Invalid JSON format (field state is invalid)")
        }

        let permissions;
        if (examGraderMap.has('permissions') && examGraderMap.get('permissions') instanceof Array) {
            permissions = Permissions.fromArray(examGraderMap.get('permissions'))
        } else {
            throw new AppError("Parsing the exam grader entry failed. Invalid JSON format (field permissions is invalid)")
        }

        let self;
        if (examGraderMap.has('self') && typeof examGraderMap.get('self') === 'boolean') {
            self = examGraderMap.get("self")
        } else {
            throw new AppError("Parsing the exam grader entry failed. Invalid JSON format (field self is invalid)")
        }

        let realName = null
        if (examGraderMap.has('encrypted_name') && typeof examGraderMap.get('encrypted_name') === 'string') {
            const graderNameDecryptionKey = userData.getDecryptionKey("other-grader-personal-data", KeyType.AUXILIARY_KEY, "exam")
            if (graderNameDecryptionKey !== null) {
                realName = await (crypto.symmetricDecrypt(examGraderMap.get('encrypted_name'), graderNameDecryptionKey))
            }
        }

        return new ExamGrader(pseudonym, realName, permissions, state, self)
    }
}