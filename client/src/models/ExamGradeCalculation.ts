import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";

export class ExamGradeCalculation {
    passedLimit: number;
    gradeLimits: Map<string, number>;

    constructor(passedLimit: number, gradeLimits: Map<string, number>) {
        this.passedLimit = passedLimit
        this.gradeLimits = gradeLimits

        // fallback if there is no 5.0 set
        if (!this.gradeLimits.has("5.0")) {
            gradeLimits.set("5.0", 0)
        }
        console.log("ExamGradeCalculation", this)
    }

    isPassed(points: number): boolean {
        if (this.passedLimit === null) {
            throw new AppError("Cannot determine whether the achieved points are sufficient to pass the exam when the exam's passed limit is unknown.")
        }
        return points >= this.passedLimit
    }

    getGrade(points: number): string {
        for(let [grade, limit] of this.gradeLimits.entries()) {
            if (points >= limit) {
                return grade
            }
        }

        return null
    }

    gradeLimitsToObject(): Object {
        return Object.fromEntries(this.gradeLimits)
    }

    static fromMap(jsonMap: Map<any, any>): ExamGradeCalculation {
        if (!jsonMap.has('grade-calculation') || !(jsonMap.get('grade-calculation') instanceof Map)) {
            throw new AppError("There was an error in parsing the grade calculation data from the API. The format of the retrieved data did not match the expected format.")
        }

        let gradeCalculationMap = jsonMap.get('grade-calculation')

        let passedLimit = null
        let gradeLimits = new Map<string, number>()
        if (gradeCalculationMap.has('passed-limit') && typeof gradeCalculationMap.get('passed-limit') === 'number') {
            passedLimit = gradeCalculationMap.get('passed-limit')
        }
        if (gradeCalculationMap.has('grade-limits') && Array.isArray(gradeCalculationMap.get('grade-limits'))) {
            for(let gradeEntry of gradeCalculationMap.get('grade-limits')) {
                if (Array.isArray(gradeEntry) && gradeEntry.length == 2 && typeof gradeEntry[0] === 'string' && typeof gradeEntry[1] === 'number') {
                    gradeLimits.set(gradeEntry[0], gradeEntry[1])
                }
            }
        }

        return new ExamGradeCalculation(passedLimit, gradeLimits)
    }

    static fromJSON(jsonObject: Object): ExamGradeCalculation {
        const jsonMap = MapHelper.deepMapify(jsonObject)
        return ExamGradeCalculation.fromMap(jsonMap)
    }

}

