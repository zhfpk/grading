import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";

export class ExamReviewConfig {
    timeframeFrom: string;
    timeframeUntil: string;
    serverTime: string;
    reviewAllowed: boolean;

    constructor(serverTime: string, timeframeFrom: string, timeframeUntil: string, reviewAllowed: boolean) {
        this.serverTime = serverTime;
        this.timeframeFrom = timeframeFrom
        this.timeframeUntil = timeframeUntil
        this.reviewAllowed = reviewAllowed
    }

    static fromJSON(jsonObject: Object): ExamReviewConfig {
        let map = MapHelper.deepMapify(jsonObject)

        console.log(map)

        const requiredAttributes = ["server_time", "timeframe_from", "timeframe_until"]

        for (const requiredAttribute of requiredAttributes) {
            if (!map.has(requiredAttribute) || map.get(requiredAttribute) === null || typeof map.get(requiredAttribute) !== 'string' || map.get(requiredAttribute).trim().length === 0) {
                throw new AppError("Parsing the exam review config failed due to invalid attribute")
            }
        }

        if (!map.has('review_allowed') || map.get('review_allowed') === null || typeof map.get('review_allowed') !== 'boolean') {
            throw new AppError("Parsing the exam review config failed due to invalid attribute")
        }

        if (isNaN(Date.parse(map.get("timeframe_from")))) {
            throw new AppError("Parsing the exam review config failed as it contains an invalid date")
        }

        if (isNaN(Date.parse(map.get("timeframe_until")))) {
            throw new AppError("Parsing the exam review config failed as it contains an invalid date")
        }


        const timeframeUntil = map.get('timeframe_until').trim()
        const timeframeFrom = map.get('timeframe_from').trim()
        const serverTime = map.get('server_time').trim()
        const reviewAllowed = map.get('review_allowed')

        return new ExamReviewConfig(serverTime, timeframeFrom, timeframeUntil, reviewAllowed)
    }
}