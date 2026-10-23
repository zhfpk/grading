import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";
import NaClCrypto from "@/models/NaClCrypto";
import {ExaminationSystemSignature} from "@/models/ExamineeSubmissions";

export class FileMapping {
    mapping: Map<string, string>;

    constructor(mapping: Map<string, string>) {
        this.mapping = mapping;
    }

    getPointsFiles(): Map<string, string> {
        return this.#filterMapping([".points"])
    }

    getAnswerFiles(): Map<string, string> {
        return this.#filterMapping([".answer"])
    }

    getSubmissionFiles(): Map<string, string> {
        return this.#filterMapping([".answer"], ["exam.handin", "data.student", "room.secret", "device.secret"])
    }

    getSubmissionFilesWithoutPersonalData(): Map<string, string> {
        return this.#filterMapping([".answer"], ["exam.handin", "data.student"])
    }

    getSubmissionFilesContainingPersonalData(): Map<string, string> {
        return this.#filterMapping([], ["room.secret", "device.secret"])
    }

    #filterMapping(acceptedSuffixes: string[], acceptedFileNames: string[] = []): Map<string, string> {
        return new Map<string, string>(
          Array.from(this.mapping.entries()).filter(([key]) => acceptedSuffixes.some(suffix => key.endsWith(suffix)) || acceptedFileNames.some(acceptedFileName => key === acceptedFileName))
        );
    }

    addEntry(originalFileName: string, mappedFileName: string): void {
        if (this.mapping.has(originalFileName)) {
            const previousValue = this.mapping.get(originalFileName)
            if (previousValue !== mappedFileName) {
                throw new AppError("There is file mapping inconsistency: Cannot map the original file to different mapped files")
            }
        }
        this.mapping.set(originalFileName, mappedFileName)
    }

    toJSON(): string {
        return JSON.stringify(Object.fromEntries(this.mapping.entries()))
    }

    static async decryptFileMapping(encryptedFileMapping: string, crypto: NaClCrypto, decryptionKey: string) {
        let fileMappingString = await crypto.symmetricDecrypt(encryptedFileMapping, decryptionKey)
        let fileMappingObject = JSON.parse(fileMappingString)

        let fileMappingMap = MapHelper.deepMapify(fileMappingObject)

        let map = new Map<string, string>()
        for (const [originalFileName, mappedFileName] of fileMappingMap.entries()) {
            if (typeof originalFileName === 'string' && typeof mappedFileName === 'string') {
                map.set(originalFileName, mappedFileName)
            }
        }
        return new FileMapping(map)
    }
}

export class FileMappings {
    fileMappings: Map<string, FileMapping>;

    constructor() {
        this.fileMappings = new Map<string, FileMapping>()
    }

    setMapping(examineeIdentifier: string, fileMapping: FileMapping) {
        this.fileMappings.set(examineeIdentifier, fileMapping)
    }

    getMapping(examineeIdentifier: string) {
        return this.fileMappings.get(examineeIdentifier)
    }
}
