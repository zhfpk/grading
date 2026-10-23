import {LocalCredentialsStore} from "@/models/LocalCredentialsStore";
import sodium from 'libsodium-wrappers'
import {AppError} from "@/models/AppError";

export default class NaClCrypto {
    masterDecryptionPrivateKey: string;
    privateSigningKey: string;

    constructor(examName: string, uuid: string, privateSigningKeyExpected: boolean) {
        this.masterDecryptionPrivateKey = null
        this.privateSigningKey = null
        this.#findLocalKeys(examName, uuid, privateSigningKeyExpected)
        console.log("this.masterDecryptionPrivateKey:", this.masterDecryptionPrivateKey)
        console.log("this.privateSigningKey:", this.privateSigningKey)
    }

    async base64ToBytes(contentBase64: string) {
        try {
            await sodium.ready
            return await sodium.from_base64(contentBase64, sodium.base64_variants.ORIGINAL)
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred converting the given base64 string into a byte array.")
        }
    }

    async symmetricDecrypt(encryptedDataBase64: string, symmetricKeyHex: string): Promise<string> {
        try {
            await sodium.ready

            const encryptedData = await this.base64ToBytes(encryptedDataBase64)
            const nonce = encryptedData.slice(0, sodium.crypto_secretbox_NONCEBYTES)
            const ciphertext = encryptedData.slice(sodium.crypto_secretbox_NONCEBYTES)
            const symmetricKey = sodium.from_hex(symmetricKeyHex)

            const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symmetricKey)

            return new TextDecoder().decode(decrypted)
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during symmetric decryption.")
        }
    }

    async symmetricEncrypt(message: string, symmetricKeyHex: string): Promise<string> {
        const messageBytes = new TextEncoder().encode(message)

        try {
            await sodium.ready

            const symmetricKey = sodium.from_hex(symmetricKeyHex)
            const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)

            const encrypted = sodium.crypto_secretbox_easy(messageBytes, nonce, symmetricKey)

            const encryptedData = new Uint8Array(nonce.length + encrypted.length)
            encryptedData.set(nonce)
            encryptedData.set(encrypted, nonce.length)

            return sodium.to_base64(encryptedData, sodium.base64_variants.ORIGINAL)

        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during symmetric encryption")
        }
    }

    async asymmetricDecrypt(encryptedDataBase64: string, privateKeyHex: string): Promise<string> {
        try {
            await sodium.ready

            const encryptedData = await this.base64ToBytes(encryptedDataBase64)
            const privateKey = sodium.from_hex(privateKeyHex)

            const publicKey = sodium.crypto_scalarmult_base(privateKey)

            const decrypted = sodium.crypto_box_seal_open(encryptedData, publicKey, privateKey)

            return new TextDecoder().decode(decrypted)
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during asymmetric decryption.")
        }
    }

    async asymmetricEncrypt(message: string, publicKeyHex: string): Promise<string> {
        const messageBytes = new TextEncoder().encode(message)

        try {
            await sodium.ready

            const publicKey = sodium.from_hex(publicKeyHex)

            const encrypted = sodium.crypto_box_seal(messageBytes, publicKey)

            return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during asymmetric encryption")
        }
    }

    hasPrivateKey() {
        return this.privateSigningKey !== undefined && this.privateSigningKey !== null
    }

    exportKeysToFragment() {
        document.location.hash = this.buildKeyFragment()
    }

    getKeys() {
        const keyRegex = /^[0-9a-f]+$/i;
        if (this.masterDecryptionPrivateKey !== null && this.masterDecryptionPrivateKey.match(keyRegex) !== null)
        {
            if (this.privateSigningKey !== null && this.privateSigningKey.match(keyRegex) !== null) {
                return {
                    privateSigningKey: this.privateSigningKey,
                    masterDecryptionPrivateKey: this.masterDecryptionPrivateKey
                }
            }
        } else {
            throw new AppError("There is no valid key to build the fragment from")
        }
    }

    buildKeyFragment(prependHashTag = true) {
        const keyRegex = /^[0-9a-f]+$/i;
        let prefix = prependHashTag === true ? "#" : ""
        if (this.masterDecryptionPrivateKey !== null && this.masterDecryptionPrivateKey.match(keyRegex) !== null)
        {
            if (this.privateSigningKey !== null && this.privateSigningKey.match(keyRegex) !== null) {
                return prefix + this.masterDecryptionPrivateKey + "_" + this.privateSigningKey
            }
            return prefix + this.masterDecryptionPrivateKey
        } else {
            throw new AppError("There is no valid key to build the fragment from")
        }
    }

    async signString(message: string){
        const encoder = new TextEncoder()
        let encodedMessage = encoder.encode(message)

        console.log("signing string", message)

        return await (this.signMessage(encodedMessage))
    }

    async signMessage(messageBytes: Uint8Array) {
        if (this.privateSigningKey === null) {
            throw new AppError("There is no valid key to be used for signing the given message")
        }

        try {
            await sodium.ready
            const privateKey = sodium.from_hex(this.privateSigningKey)
            const keypair = sodium.crypto_sign_seed_keypair(privateKey)

            console.log("privateSigningKey:", this.privateSigningKey)

            const signature = sodium.crypto_sign_detached(messageBytes, keypair.privateKey)

            return sodium.to_hex(signature)
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during signing; please reload the page and try again.")
        }
    }

    async verifyMessageSignature(message: string, signatureHex: string, publicKeyHex: string) {
        const encoder = new TextEncoder()
        let messageBytes = encoder.encode(message)

        try {
            await sodium.ready
            const publicKey = sodium.from_hex(publicKeyHex)
            const signature = sodium.from_hex(signatureHex)

            const isValid = sodium.crypto_sign_verify_detached(signature, messageBytes, publicKey)

            return isValid === true
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during signature verification; please reload the page and try again.")
        }
    }

    async verifyMessageBytesSignature(messageBytes: Uint8Array, signatureHex: string, publicKeyHex: string) {
        try {
            await sodium.ready
            const publicKey = sodium.from_hex(publicKeyHex)
            const signature = sodium.from_hex(signatureHex)

            const isValid = sodium.crypto_sign_verify_detached(signature, messageBytes, publicKey)

            return isValid === true
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during signature verification; please reload the page and try again.")
        }
    }

    async generateSigningKeyPair() {
        try {
            await sodium.ready

            const keyPair = sodium.crypto_sign_keypair()

            return {
                privateKey: sodium.to_hex(keyPair.privateKey.slice(0, sodium.crypto_sign_SEEDBYTES)),
                publicKey: sodium.to_hex(keyPair.publicKey)
            }
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during signing key generation; please reload the page and try again.")
        }
    }

    async generateMasterEncryptionKeyPair() {
        try {
            await sodium.ready

            const keyPair = sodium.crypto_box_keypair()

            return {
                privateKey: sodium.to_hex(keyPair.privateKey),
                publicKey: sodium.to_hex(keyPair.publicKey)
            }
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred during encryption key generation; please reload the page and try again.")
        }
    }

    static async getRandomBytesHex(numberBytes: number) {
        try {
            await sodium.ready
            return sodium.to_hex(sodium.randombytes_buf(numberBytes))
        } catch (e) {
            console.error(e)
            throw new AppError("An unexpected error occurred when generating a random byte sequence.")
        }
    }

    static byteBufferToHexString(uint8Array: Uint8Array): string {
        return Array.from(uint8Array).map(byte => byte.toString(16).padStart(2, "0")).join("")
    }

    static async calculateSHA256Hex(messageBytes: Uint8Array) {
        const hashBuffer = await crypto.subtle.digest("SHA-256", messageBytes)
        return NaClCrypto.byteBufferToHexString(new Uint8Array(hashBuffer))
    }

    static async calculateSHA256HexFromString(messageString: string) {
        const textEncoder = new TextEncoder()
        const messageBytes = textEncoder.encode(messageString)
        return NaClCrypto.calculateSHA256Hex(messageBytes)
    }

    #findLocalKeys(examName: string, uuid: string, privateKeyExpected: boolean) {
        let urlFragmentValue = document.location.hash

        if (urlFragmentValue.startsWith("#"))
            urlFragmentValue = urlFragmentValue.slice(1)

        const localCredentialsStore = new LocalCredentialsStore()

        if (privateKeyExpected) {
            if (NaClCrypto.isValidKeyString(urlFragmentValue, true)) {
                // load the keys from the fragment if possible
                let segments = urlFragmentValue.split("_")
                this.masterDecryptionPrivateKey = segments[0]
                this.privateSigningKey = segments[1]
            } else if (localCredentialsStore.getCredentialsByExamNameAndUuid(examName, uuid) !== null) {
                // load the keys from the local credentials store
                let credentials = localCredentialsStore.getCredentialsByExamNameAndUuid(examName, uuid)
                // note: format validated when loading the store
                let segments = credentials.keys.split("_")
                this.masterDecryptionPrivateKey = segments[0]
                this.privateSigningKey = segments[1]
            } else {
                throw new AppError("No personal keys found in URL nor in local key store. Expected a decryption key and signature key. Did you manipulate your keys?")
            }
        } else {
            if (NaClCrypto.isValidKeyString(urlFragmentValue, false)) {
                this.masterDecryptionPrivateKey = urlFragmentValue
                this.privateSigningKey = null
            } else {
                throw new AppError("Invalid key format in URL. Expected a decryption key, however, the provided format is wrong. Did you manipulate your keys?")
            }
        }
    }

    static isValidKeyString(str: string, privateSigningKeyExpected: boolean) {
        if (str.length <= 1) {
            return false
        }

        if (str.startsWith("#"))
            str = str.slice(1)

        if (privateSigningKeyExpected) {
            const regex = /^[0-9a-f]{64}_[0-9a-f]{64}$/i
            return str.match(regex) !== null
        } else {
            const regex = /^[0-9a-f]{64}$/i
            return str.match(regex)
        }
    }

}