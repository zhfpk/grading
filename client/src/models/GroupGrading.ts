import {GradingInput, GradingPoints} from "@/models/ExamineeGradingPoints";

export class GroupGradingGroups {
    numTotalSubmissions: number;
    numLockedSubmissions: number;
    numLockedGradings: number;
    groups: Map<string, GroupGradingEntry>;

    constructor() {
        this.numTotalSubmissions = 0
        this.numLockedSubmissions = 0
        this.numLockedGradings = 0
        this.groups = new Map<string, GroupGradingEntry>()
    }

    addGradingGroup(submittedValue: string, gradingPoints: GradingPoints) {
        const keyObject = {
            submissionValue: submittedValue,
            points: gradingPoints.points,
            comment: gradingPoints.comment,
            annotation: gradingPoints.annotation
        }
        let keyJSON: string = JSON.stringify(keyObject)
        if (this.groups.has(keyJSON)) {
            this.groups.get(keyJSON).addExamineeGradingPoints(gradingPoints)
        } else {
            let groupGradingEntry = new GroupGradingEntry(submittedValue, gradingPoints)
            this.groups.set(keyJSON, groupGradingEntry)
        }
    }

    incrementTotalSubmissions() {
        this.numTotalSubmissions += 1
    }

    incrementLockedSubmission() {
        this.numLockedSubmissions += 1
    }

    incrementLockedGradings() {
        this.numLockedGradings += 1
    }

    getShownSubmissionCount(): number {
        return this.numTotalSubmissions - (this.numLockedSubmissions+this.numLockedSubmissions)
    }

    getGroups() {
        return this.groups.values()
    }

    getGradingDoneCount(): number {
        return [...this.groups.values()].filter(g => g.isGradingDone()).length;
    }

    getSortedGroups(sortByValue: string) {
        let [attribute, order] = sortByValue.split("-")
        let multiply = order === 'desc' ? -1 : 1

        return [...this.groups.values()].sort((a, b) => {
            if (attribute === 'frequency') {
                return (a.getOccurrences() - b.getOccurrences()) * multiply
            } else if (attribute === 'points') {
                let aPoints = a.getPoints() === null ? -1 : a.getPoints()
                let bPoints = b.getPoints() === null ? -1 : b.getPoints()
                return (aPoints - bPoints) * multiply
            } else if (attribute === 'length') {
                let aLength = a.submittedValue === null ? 0 : a.submittedValue.length
                let bLength = b.submittedValue === null ? 0 : b.submittedValue.length
                return (aLength - bLength) * multiply
            }
        })
    }

    getGradingInputStrings(): string[] {
        let set = new Set<string>()

        for (let group of this.groups.values()) {
            set.add(group.toGradingInputValue())
        }

        return [...set].sort()
    }

    getGroupCount(): number {
        return this.groups.size
    }
}


export class GroupGradingEntry {
    submittedValue: string;
    examineeGradingPoints: Array<GradingPoints>;

    constructor(submittedValue: string, gradingPoints: GradingPoints) {
        this.submittedValue = submittedValue
        this.examineeGradingPoints = new Array<GradingPoints>(gradingPoints)
    }

    addExamineeGradingPoints(gradingPoints: GradingPoints) {
        this.examineeGradingPoints.push(gradingPoints)
    }

    toGradingInputValue() {
        // note: by definition, all elements must have the same GradingInput, otherwise they would not be a group
        return this.examineeGradingPoints[0].toGradingInput().toInputValue()
    }

    isGradingDone(): boolean {
        // note: by definition, all elements must have the same grading, otherwise they would not be a group
        return this.examineeGradingPoints[0].isDone()
    }

    matchesFilter(filterExpression: string): boolean {
        try {
            return filterExpression.length === 0 || this.submittedValue.match(filterExpression) !== null
        } catch (e) {
            return true
        }
    }

    getOccurrences(): number {
        return this.examineeGradingPoints.length
    }

    getPoints(): number {
        return this.examineeGradingPoints[0].points
    }
}