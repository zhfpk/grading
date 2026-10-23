import { createApp } from 'vue'
import ExamApi, {getQueryParameters} from "@/models/ExamApi";
import {createPinia} from "pinia";
import IndividualExamSummary from "@/components/IndividualExamSummary.vue";
import {useGradingStore, useSettingsStore} from "@/individual-grading-store.js";
import SubtaskFieldGrading from "@/components/SubtaskFieldGrading.vue";
import IndividualGradingSubtaskAside from "@/components/IndividualGradingSubtaskAside.vue";
import {AppError} from "@/models/AppError";

export function callInitializePage() {
  if (typeof PAGE_MODE === 'undefined') {
    return
  }

  if (PAGE_MODE !== 'GRADING' && PAGE_MODE !== 'REVIEW') {
    return
  }

  document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializePage(PAGE_MODE)
  } catch (e) {
    console.error(e)
  }
});
}

const initializePage = async (pageMode: string) => {
  // Select all elements with the class 'vue-task-points'
  const vueExamSummaryElements = document.querySelectorAll('.vue-exam-summary-app');
  // Select all elements with the class 'vue-task-points'
  const vueSubtaskFieldGradingElements = document.querySelectorAll('.vue-subtask-field-grading-app');

  const vueIndividualGradingSubtaskAsideElements = document.querySelectorAll(".vue-individual-grading-subtask-aside-app")

  if (vueExamSummaryElements.length === 0) {
    // not the individual grading page ...
    return
  }

  const queryParameters = getQueryParameters()
  if (!queryParameters.has("examinee")) {
    throw new AppError("No examinee specified. Select an examinee to grade first.")
  }
  let examineeIdentifier = queryParameters.get('examinee')

  const pinia = createPinia()

  const privateKeyExpected = pageMode === 'GRADING'
  const examApi = new ExamApi(privateKeyExpected)
  await examApi.initialize()

  // const settingsStore = useSettingsStore(pinia)

  // load the task data of the exam
  const examTasksData = await examApi.getTasksData()

  let examPhase = null;
  if (pageMode === 'REVIEW') {
    examPhase = 'review'
  } else {
    examPhase = await examApi.getExamPhase()
  }
  const gradeCalculation = await examApi.getExamGradeCalculation()

  const submissions = await examApi.getSubmissions(examineeIdentifier)
  console.log("submissions", submissions)

  if (!submissions.hasSubmissionsOf(examineeIdentifier)) {
    throw new AppError("Submissions: Unknown examinee given")
  }
  const examineeSubmissions = submissions.getSubmissionsOf(examineeIdentifier)

  console.log("examineeSubmissions", examineeSubmissions)

  const gradingPoints = await examApi.getGradingPoints(examineeIdentifier)
  console.log("gradingPoints", gradingPoints)

  const examineeGradingPoints = gradingPoints.getGradingsOf(examineeIdentifier)
  console.log("examineeGradingPoints", examineeGradingPoints)

  const gradingStore = useGradingStore(pinia)
  gradingStore.initialize(examineeGradingPoints)

  // determine next and previous examinee (exclude or include no-shows depending on selected examinee)
  const neighboringExaminees = submissions.getNeighboringExaminee(examineeIdentifier)

  // even when it is a no-show, display the examinee summary
  vueExamSummaryElements.forEach((element) => {
    const props = {
      examineeSubmissions: examineeSubmissions,
      examTasksData: examTasksData,
      examPhase: examPhase,
      gradingMode: pageMode === 'GRADING',
      validPublicKeys: gradingPoints.validPublicKeys,
      examGradeCalculation: gradeCalculation,
      previousExamineeIdentifier: neighboringExaminees.previous,
      nextExamineeIdentifier: neighboringExaminees.next
    };
    const app = createApp(IndividualExamSummary, props)
    app.provide('examApi', examApi)
    app.use(pinia)
    app.mount(element);
  })

  // create the remaining vue apps only if it is *not* a no-show
  if (!examineeSubmissions.isNoShow()) {
    if (!gradingPoints.hasGradingPointsOf(examineeIdentifier)) {
      throw new AppError("Gradings: Unknown examinee given")
    }

    vueIndividualGradingSubtaskAsideElements.forEach((element) => {
      const subtaskIdentifier = element.getAttribute('data-subtask-identifier')

      const subtask = examTasksData.getSubtask(subtaskIdentifier)

      const props = {
        allocatedPoints: subtask.points,
        examTasksData: examTasksData,
        subtaskIdentifier: subtaskIdentifier,
        examineeSubmissions: examineeSubmissions
      };

      // Mount the component with the props for this element
      const app = createApp(IndividualGradingSubtaskAside, props)
      app.use(pinia)
      app.mount(element)
    })

    vueSubtaskFieldGradingElements.forEach((element) => {
      let label = ""
      if (element.querySelector("label") !== null) {
        label = element.querySelector("label").innerHTML
      }

      const fieldIdentifier = element.getAttribute('data-field-identifier')
      const fieldType = element.getAttribute('data-field-type')
      const subtaskIdentifier = element.getAttribute('data-subtask-identifier')
      const isNoGradingChosen = examineeSubmissions.isNoGradingChosen()

      const subtaskFieldSubmission = examineeSubmissions.getSubtaskFieldAnswer(fieldIdentifier)

      const props = {
        fieldIdentifier: fieldIdentifier,
        label: label,
        fieldType: fieldType,
        subtaskIdentifier: subtaskIdentifier,
        submission: subtaskFieldSubmission,
        isNoGradingChosen: isNoGradingChosen,
        examPhase: examPhase
      };

      const app = createApp(SubtaskFieldGrading, props)
      app.use(pinia)
      app.provide('examApi', examApi)
      app.mount(element);
    });

    document.querySelector('.all-tasks-container').classList.remove('hidden')
  } else {
    // is a no-show -> delete the all-tasks container
    document.querySelector(".all-tasks-container").remove()
  }
}

