import {MapHelper} from "@/models/MapHelper";
import {AppError} from "@/models/AppError";

export class ExamTasksData {
    examName: string;
    examShortName: string;
    examDate: string;
    tasks: Array<ExamTask>;

    constructor(examName: string, examShortName: string, examDate: string, tasks: Array<ExamTask>) {
        this.examName = examName
        this.examShortName = examShortName
        this.examDate = examDate
        this.tasks = tasks
        console.log("ExamTasksData", this)
    }

    getSubtask(subtaskIdentifier: string): ExamSubtask {
        for(let task of this.tasks) {
            let subtask = task.getSubtask(subtaskIdentifier)
            if (subtask !== null)
                return subtask
        }
        return null
    }

    getSubtasks(): Array<ExamSubtask> {
        return this.tasks.flatMap(task => task.subtasks)
    }

    getSubtaskFields(): Array<ExamSubtaskField> {
        return this.getSubtasks().flatMap(subtask => subtask.fields)
    }

    getSubtaskFieldNames(): Array<string> {
        return this.getSubtaskFields().map(e => e.identifier)
    }

    static fromJSON(jsonObject: Object): ExamTasksData {
        let jsonMap = MapHelper.deepMapify(jsonObject)

        let tasks = new Array<ExamTask>()

        if (jsonMap.has('tasks') && Array.isArray(jsonMap.get('tasks'))) {
            for (let taskObject of jsonMap.get('tasks')) {
                let taskMap = MapHelper.deepMapify(taskObject)
                tasks.push(ExamTask.fromMap(taskMap))
            }
        } else {
            throw new AppError("Parsing the exam task data failed as the response from the API did not have the expected format")
        }

        let examName = null
        let examShortName = null
        let examDate = null

        if (jsonMap.has('exam')) {
            const examMap = jsonMap.get('exam')
            examName = examMap.has('name') ? examMap.get('name') : null
            examShortName = examMap.has('shortname') ? examMap.get('shortname') : null
            examDate = examMap.has('date') ? examMap.get('date') : null
        }

        return new ExamTasksData(examName, examShortName, examDate, tasks)
    }
}

export class ExamTask {
    name: string;
    subtasks: Array<ExamSubtask>;

    constructor(name: string, subtasks: Array<ExamSubtask>) {
        this.name = name
        this.subtasks = subtasks
    }

    getSubtask(subtaskIdentifier: string) {
        return this.subtasks.find(subtask => subtask.name === subtaskIdentifier) || null
    }

    getSubtaskFields(): Array<ExamSubtaskField> {
        return this.subtasks.flatMap(subtask => subtask.fields)
    }

    static fromMap(jsonMap: Map<any, any>) {
        let subtasks = new Array<ExamSubtask>()

        if (!jsonMap.has('subtasks') || !Array.isArray(jsonMap.get('subtasks'))) {
            throw new AppError("Parsing the exam task failed as the provided task data does not have listed subtasks (tasks without any subtasks are invalid)")
        }

        if (!jsonMap.has('name') || typeof jsonMap.get('name') !== 'string') {
            throw new AppError("Parsing the exam task failed as the provided task name does not match the expected format")
        }

        for (let subtaskObject of jsonMap.get('subtasks')) {
            let subtaskMap = MapHelper.deepMapify(subtaskObject)
            let subtask = ExamSubtask.fromMap(subtaskMap)
            subtasks.push(subtask)
        }

        return new ExamTask(jsonMap.get('name'), subtasks)
    }
}

export class ExamSubtask {
    name: string;
    points: number;
    fields: Array<ExamSubtaskField>;

    constructor(name: string, points: number, fields: Array<ExamSubtaskField>) {
        this.name = name
        this.points = points
        this.fields = fields
    }

    static fromMap(jsonMap: Map<any, any>) {
        if (!jsonMap.has('name') || typeof jsonMap.get('name') !== 'string') {
            throw new AppError("Parsing the exam subtask failed as the subtask's name is invalid")
        }

        if (!jsonMap.has('points') || typeof jsonMap.get('points') !== 'number') {
            throw new AppError("Parsing the exam subtask failed as the subtask's point field is invalid")
        }

        if (!jsonMap.has('fields') || !Array.isArray(jsonMap.get('fields'))) {
            throw new AppError("Parsing the exam subtask failed as the provided subtask's fields are invalid")
        }

        let fields = new Array<ExamSubtaskField>()
        for (let fieldObject of jsonMap.get('fields')) {
            let fieldMap = MapHelper.deepMapify(fieldObject)
            let field = ExamSubtaskField.fromMap(fieldMap)
            fields.push(field)
        }

        return new ExamSubtask(jsonMap.get('name'), jsonMap.get('points'), fields)
    }
}

export class ExamSubtaskField {
    static VALID_FIELD_TYPES = ['paper', 'tex', 'text']

    identifier: string;
    fieldType: string;

    constructor(identifier: string, fieldType: string) {
        this.identifier = identifier
        this.fieldType = fieldType
    }

    static fromMap(jsonMap: Map<any, any>) {
        if (!jsonMap.has('identifier') || typeof jsonMap.get('identifier') !== 'string') {
            throw new AppError("Parsing the exam subtask field failed as the field's identifier is invalid")
        }

        if (!jsonMap.has('field_type') || typeof jsonMap.get('field_type') !== 'string' || !ExamSubtaskField.VALID_FIELD_TYPES.includes(jsonMap.get('field_type'))) {
            throw new AppError("Parsing the exam subtask field failed as the field's type is invalid")
        }

        return new ExamSubtaskField(jsonMap.get('identifier'), jsonMap.get('field_type'))
    }

}