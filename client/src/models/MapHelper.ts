import {AppError} from "@/models/AppError";

export class MapHelper {
    static MAX_DEPTH = 10

    static deepMapify(obj: Object, depth = 0) {
        if (depth > MapHelper.MAX_DEPTH) {
            throw new AppError('The provided object to be converted to a map is too deeply nested')
        }

        if (!MapHelper.#isPlainObject(obj)) {
            throw new TypeError('Expected a plain object')
        }

        const result = new Map();

        for (const [key, value] of Object.entries(obj)) {
            if (MapHelper.#isPlainObject(value)) {
                result.set(key, MapHelper.deepMapify(value, depth + 1))
            } else {
                result.set(key, value)
            }
        }

        return result;
    }

    static #isPlainObject(value: any) {
        return (
            typeof value === 'object' &&
            value !== null &&
            Object.getPrototypeOf(value) === Object.prototype
        )
    }

}

