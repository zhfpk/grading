import {AppError} from "@/models/AppError";
import NaClCrypto from "@/models/NaClCrypto";

/**
 * @interface Credentials
 * Represents a single user account.
 */
interface Credentials {
    uuid: string;
    keys: string;
    examName: string;
    graderPseudonym: string;
}

/**
 * @interface StoredCredentials
 * Represents the map-like structure where examName maps to an array of Credentials.
 * This is the top-level structure stored in localStorage.
 */
interface StoredCredentials {
    [examName: string]: Credentials[];
}

/**
 * @class LocalCredentialsStore
 * Manages user accounts (credentials) stored in localStorage.
 * Accounts are organized by examName. The class validates data upon loading,
 * discarding any malformed credential objects while retaining valid ones.
 */
export class LocalCredentialsStore {
    private localStorageKey: string;

    // Internal storage as a Map for easier manipulation and type safety
    private accounts: Map<string, Credentials[]>;

    /**
     * Creates an instance of LocalCredentialsStore.
     * @param localStorageKey The key to use when storing data in localStorage.
     */
    constructor(localStorageKey: string = 'grading-app-credential-store') {
        this.localStorageKey = localStorageKey;
        this.accounts = new Map();
        this.loadAccounts();
    }

    /**
     * Checks if a given object adheres to the Credentials interface structure.
     * @param obj The object to validate.
     * @returns True if the object is a valid Credentials object, false otherwise.
     * @private
     */
    private isValidCredential(obj: any): obj is Credentials {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj.uuid === 'string' &&
            typeof obj.keys === 'string' &&
            typeof obj.examName === 'string' &&
            NaClCrypto.isValidKeyString(obj.keys, true)
        );
    }

    /**
     * Loads account data from localStorage and populates the internal Map.
     * Handles parsing JSON and validates each credential individually.
     * If an individual credential record is invalid, it is discarded, but valid ones are kept.
     * If the entire data structure is corrupted or unparseable, it clears the data and starts fresh.
     * @private
     */
    private loadAccounts(): void {
        try {
            const data = localStorage.getItem(this.localStorageKey);
            if (!data) {
                console.log("LocalCredentialsStore: No existing data found in localStorage. Starting fresh.");
                return;
            }

            const storedData: any = JSON.parse(data);
            console.log(storedData)

            if (typeof storedData !== 'object' || storedData === null || Array.isArray(storedData)) {
                console.warn("LocalCredentialsStore: LocalStorage data is not a valid object structure. Clearing and starting fresh.");
                localStorage.removeItem(this.localStorageKey);
                return;
            }

            let wasDataCleaned = false;
            for (const examName in storedData) {
                if (Object.prototype.hasOwnProperty.call(storedData, examName)) {
                    const credentialList = storedData[examName];

                    if (!Array.isArray(credentialList)) {
                        console.warn(`LocalCredentialsStore: Data for exam '${examName}' is not an array. Discarding this entry.`);
                        wasDataCleaned = true;
                        continue;
                    }

                    const validCredentials = credentialList.filter(cred => this.isValidCredential(cred));

                    if (validCredentials.length < credentialList.length) {
                        const discardedCount = credentialList.length - validCredentials.length;
                        console.warn(`LocalCredentialsStore: Discarded ${discardedCount} invalid credential(s) for exam '${examName}'.`);
                        wasDataCleaned = true;
                    }

                    if (validCredentials.length > 0) {
                        this.accounts.set(examName, validCredentials);
                    }
                }
            }

            console.log("LocalCredentialsStore: Credentials loaded from localStorage.");

            if (wasDataCleaned) {
                console.log("LocalCredentialsStore: Resaving cleaned data back to localStorage.");
                this.saveAccounts();
            }

        } catch (error) {
            console.error('LocalCredentialsStore: Error loading credentials from localStorage:', error);
            console.warn("LocalCredentialsStore: Data might be corrupted or unparseable. Clearing and starting fresh.");
            localStorage.removeItem(this.localStorageKey);
            this.accounts.clear();
        }
    }

    /**
     * Saves the current internal credentials Map to localStorage.
     * Converts the Map to a plain object before stringify to JSON.
     * @private
     */
    private saveAccounts(): void {
        try {
            const accountsToSave: StoredCredentials = {};
            this.accounts.forEach((credentialList, examName) => {
                accountsToSave[examName] = credentialList;
            });

            localStorage.setItem(this.localStorageKey, JSON.stringify(accountsToSave));
            console.log("LocalCredentialsStore: Credentials saved to localStorage.");
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                throw new AppError("The local storage of your browser is full. Please remove some of your stored credentials.")
            }
            console.error('LocalCredentialsStore: Error saving credentials to localStorage:', error);
        }
    }

    /**
     * Adds a new credential. If a credential with the same UUID already exists
     * under the same examName, it will be updated. Otherwise, it is added.
     * @param newCredential The Credentials object to add or update.
     * @returns True if the credential was added/updated, false if the object was invalid.
     */
    public addCredential(newCredential: Credentials): boolean {
        if (!this.isValidCredential(newCredential)) {
            console.error("LocalCredentialsStore: Attempted to add an invalid credential object.", newCredential);
            return false;
        }

        const examCredentials = this.accounts.get(newCredential.examName) || [];
        const existingIndex = examCredentials.findIndex(cred => cred.uuid === newCredential.uuid);

        if (existingIndex > -1) {
            examCredentials[existingIndex] = newCredential;
            console.log(`LocalCredentialsStore: Credential ${newCredential.uuid} updated.`);
        } else {
            examCredentials.push(newCredential);
            console.log(`LocalCredentialsStore: Credential ${newCredential.uuid} added.`);
        }

        this.accounts.set(newCredential.examName, examCredentials);
        this.saveAccounts();
        return true;
    }

    /**
     * Retrieves all credentials associated with a specific examName.
     * @param examName The name of the exam.
     * @returns A copy of the array of Credentials for the given examName, or an empty array if not found.
     */
    public getCredentialsByExamName(examName: string): Credentials[] {
        const credentials = this.accounts.get(examName) || []
        console.log(`LocalCredentialsStore: Found ${credentials.length} credentials for examName '${examName}'.`)
        return [...credentials]
    }

    /**
     * Retrieves a specific credential by its examName and UUID.
     * @param examName The name of the exam.
     * @param uuid The UUID of the credential.
     * @returns The Credentials object if found, otherwise null.
     */
    public getCredentialsByExamNameAndUuid(examName: string, uuid: string): Credentials | null {
        const credentialsList = this.getCredentialsByExamName(examName)
        const credential = credentialsList.find(c => c.uuid === uuid)
        return credential || null
    }

    /**
     * Retrieves all credentials currently stored.
     * @returns An array of all Credentials objects across all exams.
     */
    public getAllCredentials(): Credentials[] {
        const allCredentials: Credentials[] = []
        this.accounts.forEach(examCredentials => {
            allCredentials.push(...examCredentials)
        })
        console.log(`LocalCredentialsStore: Retrieved ${allCredentials.length} total credentials.`)
        return allCredentials
    }

    /**
     * Deletes a credential by its UUID.
     * @param uuidToDelete The UUID of the credential to delete.
     * @returns True if the credential was found and deleted, false otherwise.
     */
    public deleteCredential(uuidToDelete: string): boolean {
        let deleted = false;
        let examNameOfDeletedCredential: string | null = null;

        for (const [examName, examCredentials] of this.accounts.entries()) {
            const initialLength = examCredentials.length
            const updatedCredentials = examCredentials.filter(cred => cred.uuid !== uuidToDelete)

            if (updatedCredentials.length < initialLength) {
                deleted = true
                examNameOfDeletedCredential = examName

                if (updatedCredentials.length === 0) {
                    this.accounts.delete(examName)
                    console.log(`LocalCredentialsStore: Removed empty examName key: ${examName}`)
                } else {
                    this.accounts.set(examName, updatedCredentials)
                }
                break
            }
        }

        if (deleted) {
            console.log(`LocalCredentialsStore: Credential ${uuidToDelete} from exam '${examNameOfDeletedCredential}' was deleted.`);
            this.saveAccounts();
        } else {
            console.warn(`LocalCredentialsStore: Credential with UUID ${uuidToDelete} not found.`);
        }
        return deleted;
    }

    /**
     * Clears all credentials from localStorage and the internal manager.
     */
    public clearAllCredentials(): void {
        localStorage.removeItem(this.localStorageKey);
        this.accounts.clear();
        console.log("LocalCredentialsStore: All credential data has been removed.");
    }
}