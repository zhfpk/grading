import {KeyType} from "@/models/Enums";
import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";

export class User {
    permissions: Permissions;
    keyStore: UserKeyStore;
    publicSigningKey: string;
    pseudonym: string;
    realName: string;

    constructor(permissions: Permissions, keyStore: UserKeyStore, publicSigningKey=null, pseudonym=null, realName=null) {
        this.permissions = permissions
        this.keyStore = keyStore
        this.publicSigningKey = publicSigningKey
        this.pseudonym = pseudonym
        this.realName = realName
        console.log("User", this)
    }

    hasPublicSigningKey() {
        return this.publicSigningKey !== undefined && this.publicSigningKey !== null
    }

    getDecryptionKey(keyName: string, type: KeyType, keyGroupName=null) {
        return this.keyStore.getKey(keyName, type, keyGroupName)
    }

    getEncryptionKey(keyName: string, type: KeyType, keyGroupName=null) {
        return this.keyStore.getKey(keyName, type, keyGroupName)
    }
}


export class Permissions {
    permissions: Array<string>;

    constructor(permissions: Array<string>) {
        this.permissions = permissions
    }

    static fromArray(rawPermissions: Array<string>): Permissions {
        if (!Array.isArray(rawPermissions)) {
            throw new AppError("Parsing the permissions failed as the API response does not have the expected format (permissions must be an array)")
        }

        const permissions = new Array<string>()
        for (let entry of rawPermissions) {
            if (typeof entry === 'string') {
                permissions.push(entry)
            } else {
                throw new AppError('Parsing the permissions failed as the permission entry is invalid (type is not string)')
            }
        }
        return new Permissions(permissions)
    }

    hasPermission(permission: string): boolean {
        let targetPermission = Permission.fromString(permission)

        if (targetPermission.names.length < 2) {
            return false
        }

        console.log("checking for permission", permission, "=>", targetPermission)
        let currentPrefix = targetPermission.names[0]
        for (let i=1; i < targetPermission.names.length; i++) {
            let entry = targetPermission.names[i]
            let wildcardCount = targetPermission.names.length - i
            let toCheck = currentPrefix + ":*".repeat(wildcardCount)
            console.log("> checking for", toCheck)
            if (this.permissions.includes(toCheck)) {
                console.log(">> HAS PERMISSION")
                return true
            }
            toCheck = currentPrefix + ":" + entry
            console.log("> checking for", toCheck)
            if (this.permissions.includes(toCheck)) {
                console.log(">> HAS PERMISSION")
                return true
            }
            currentPrefix += ":" + entry
        }
        console.log(">> FAILED PERMISSION")

        return false
    }
}


export class Permission {
    names: Array<string>;

    constructor(...args) {
        this.names = []
        for (let i=0; i < args.length; i++) {
            if (typeof args[i] === 'string') {
                this.names.push(args[i])
            } else {
                throw new TypeError("Invalid parameter for Permission")
            }
        }
    }

    static fromString(permission: string): Permission {
        let split = permission.split(":")
        return new Permission(...split)
    }
}


export class UserKeyStore {
    keys: Map<string, KeyGroup>

    constructor(keys: Map<string, KeyGroup>) {
        this.keys = keys
        console.log("UserKeyStore", this)
    }

    addKey(keyName: string, type: KeyType, keyGroupName: string, key: string) {
        if (!this.keys.has(keyGroupName)) {
            this.keys.set(keyGroupName, new KeyGroup(new Map<string, string>(), new Map<string, string>()))
        }

        this.keys.get(keyGroupName).addKey(keyName, type, key)
    }

    addKeys(keys: Map<string, string>, type: KeyType, keyGroupName: string) {
        for (let [keyName, key] of keys.entries()) {
            this.addKey(keyName, type, keyGroupName, key)
        }
    }

    getKey(keyName: string, type: KeyType, keyGroupName: string) {
        if (!this.keys.has(keyGroupName)) {
            return null
        }

        return this.keys.get(keyGroupName).getKey(keyName, type)
    }

    getMatchingKeys(keyPrefix: string, type: KeyType, keyGroupName: string): Map<string, string> {
        if (!this.keys.has(keyGroupName)) {
            return null
        }

        return this.keys.get(keyGroupName).getMatchingKeys(keyPrefix, type)
    }

    getAvailableExamineeIdentifiers(): Array<string> {
        return [...this.keys.keys()].filter(k => k !== "exam")
    }

    toJSON(): string {
        const obj = {}

        for (let [keyGroupName, keyGroup] of this.keys.entries()) {
            obj[keyGroupName] = {}
            console.log("here, entry for", keyGroupName)
            if (keyGroup.fileKeys !== null && keyGroup.fileKeys.size > 0) {
                console.log("here, added file keys", keyGroup.fileKeys)
                obj[keyGroupName]['file-keys'] = Object.fromEntries(keyGroup.fileKeys.entries())
                console.log("here, file keys in object", obj[keyGroupName]['file-keys'])
            }
            if (keyGroup.auxiliaryKeys !== null && keyGroup.auxiliaryKeys.size > 0) {
                obj[keyGroupName]['auxiliary-keys'] = Object.fromEntries(keyGroup.auxiliaryKeys.entries())
            }
        }

        return JSON.stringify(obj)
    }

    static fromJSON(jsonObject: Object): UserKeyStore {
        const jsonMap = MapHelper.deepMapify(jsonObject)

        const processedKeyMap = new Map<string, KeyGroup>()

        for (let [keyGroupName, keyGroupMap] of jsonMap.entries()) {
            if (typeof keyGroupName !== 'string') {
                throw new AppError("Parsing the user's key store failed as the key group name has an invalid type (type must be string)")
            }
            if (!(keyGroupMap instanceof Map)) {
                throw new AppError("Parsing the user's key store failed as the key group has an invalid type (type must be map)")
            }

            processedKeyMap.set(keyGroupName, KeyGroup.fromMap(keyGroupMap))
        }

        return new UserKeyStore(processedKeyMap)
    }

}


export class KeyGroup {
    fileKeys: Map<string, string>;
    auxiliaryKeys: Map<string, string>;

    constructor(fileKeys: Map<string, string>, auxiliaryKeys: Map<string, string>) {
        this.fileKeys = fileKeys
        this.auxiliaryKeys = auxiliaryKeys
    }

    addKey(keyName: string, keyType: KeyType, keyValue: string): void {
        if (keyType === KeyType.FILE_KEY) {
            this.fileKeys.set(keyName, keyValue)
        } else if (keyType === KeyType.AUXILIARY_KEY) {
            this.auxiliaryKeys.set(keyName, keyValue)
        } else {
            throw new AppError("Cannot add unsupported key type to the key store")
        }
    }

    getKey(keyName: string, keyType: KeyType): string {
        if (keyType === KeyType.FILE_KEY) {
            return this.fileKeys.has(keyName) ? this.fileKeys.get(keyName) : null
        } else if (keyType === KeyType.AUXILIARY_KEY) {
            return this.auxiliaryKeys.has(keyName) ? this.auxiliaryKeys.get(keyName) : null
        }
        return null
    }

    getMatchingKeys(keyPrefix: string, keyType: KeyType): Map<string, string> {
        let keysToSearch = null
        let matchingKeys = new Map<string, string>()

        if (keyType === KeyType.FILE_KEY) {
            keysToSearch = this.fileKeys
        } else if (keyType === KeyType.AUXILIARY_KEY) {
            keysToSearch = this.auxiliaryKeys
        } else {
            return null
        }

        for (let [keyName, keyValue] of keysToSearch.entries()) {
            if (keyName.startsWith(keyPrefix)) {
                matchingKeys.set(keyName, keyValue)
            }
        }

        if (matchingKeys.size > 0) {
            return matchingKeys
        }
        return null
    }

    static fromMap(jsonMap: Map<any, any>): KeyGroup {
        let fileKeys = new Map<string, string>()
        let auxiliaryKeys = new Map<string, string>()

        if (jsonMap.has('file-keys')) {
            if (!(jsonMap.get('file-keys') instanceof Map)) {
                throw new AppError("Invalid format of key file (file-keys in key group is not a map)")
            }
            for (let [fileKeyName, fileKeyValue] of jsonMap.get('file-keys')) {
                if (typeof fileKeyName !== 'string' || typeof fileKeyValue !== 'string') {
                    throw new AppError("Invalid format of key file (file-keys in key group have invalid key name or key value)")
                }
                fileKeys.set(fileKeyName, fileKeyValue)
            }
        }

        if (jsonMap.has('auxiliary-keys')) {
            if (!(jsonMap.get('auxiliary-keys') instanceof Map)) {
                throw new AppError("Invalid format of key file (auxiliary-keys in key group is not a map)")
            }
            for (let [auxiliaryKeyName, auxiliaryKeyValue] of jsonMap.get('auxiliary-keys')) {
                if (typeof auxiliaryKeyName !== 'string' || typeof auxiliaryKeyValue !== 'string') {
                    throw new AppError("Invalid format of key file (auxiliary-keys in key group have invalid key name or key value)")
                }
                auxiliaryKeys.set(auxiliaryKeyName, auxiliaryKeyValue)
            }
        }

        return new KeyGroup(fileKeys, auxiliaryKeys)
    }
}