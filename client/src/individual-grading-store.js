import {defineStore} from "pinia";
import {computed, ref} from "vue";
import {GradingType, LocalStorageSettings} from "@/models/Enums";
import {SummarizedExamPoints, SummarizedSubtaskPoints} from "@/models/ExamineeGradingPoints";
import {AppError} from "@/models/AppError";

export const useGradingStore = defineStore('grading', () => {

    const examineeGradingPoints = ref(null)

    function getSummarizedExamPoints(examTasksData, gradeCalculation) {
        if (examineeGradingPoints.value === null) {
            return new SummarizedExamPoints()
        }
        return examineeGradingPoints.value.getSummarizedExamPoints(examTasksData, gradeCalculation)
    }

    function getSummarizedSubtaskPoints(examTasksData, subtaskIdentifier) {
        if (examineeGradingPoints.value === null) {
            return new SummarizedSubtaskPoints()
        }
        return examineeGradingPoints.value.getSummarizedSubtaskPoints(examTasksData, subtaskIdentifier)
    }

    function update(subtaskFieldIdentifier, gradingInput) {
        if (examineeGradingPoints.value === null) {
            throw new AppError("Initialization of global store required before grading")
        }

        let updatedGradingPoints = examineeGradingPoints.value.updateGradingPoints(subtaskFieldIdentifier, gradingInput, GradingType.INDIVIDUAL_GRADING)
        return updatedGradingPoints
    }

    function getGradingPoints(subtaskFieldIdentifier) {
        if (examineeGradingPoints.value === null) {
            throw new AppError("Initialization of global store required before grading")
        }
        return examineeGradingPoints.value.getGradingPointsForSubtaskField(subtaskFieldIdentifier)
    }

    function getContent() {
        if (examineeGradingPoints.value === null) {
            throw new AppError("Initialization of global store required before grading")
        }
        return examineeGradingPoints.value
    }

    function initialize(examineeGradings) {
        examineeGradingPoints.value = examineeGradings
    }
    return { getSummarizedExamPoints, getGradingPoints, getContent, getSummarizedSubtaskPoints, update, initialize }
})


export const useSettingsStore = defineStore('settings', () => {

    const wordWrapEnabled = ref(window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_WORD_WRAP) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_WORD_WRAP) == 'true' : true)
    const visibleWhitespaces = ref(window.localStorage.getItem(LocalStorageSettings.UI_VISUALIZE_WHITESPACES) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_VISUALIZE_WHITESPACES) == 'true' : false)
    const useMonospaceFont = ref(window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_MONOSPACE_FONT) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_SUBMISSION_MONOSPACE_FONT) == 'true' : false)


    return { wordWrapEnabled, visibleWhitespaces, useMonospaceFont }
})