<script setup lang="ts">

import {computed, onMounted, ref} from "vue";
import ExamApi, {getQueryParameters} from "@/models/ExamApi";
import {PairedExamineeGradingSubmissions} from "@/models/PairedExamineeGradingSubmissions";
import {ExamTask, ExamTasksData} from "@/models/ExamTaskData";
import MessageContainer from "@/components/base/MessageContainer.vue";
import SettingsToggle from "@/components/base/SettingsToggle.vue";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";
import {SubtaskFieldGradingsImport} from "@/models/Importing";
import {AppError} from "@/models/AppError";

const examApi = new ExamApi()

let examGradeCalculation = null
let pairedExamineeGradingSubmissions: PairedExamineeGradingSubmissions = null

const examPhase = ref<string>(null)
const examTasksData = ref<ExamTasksData>(null)
const errorMessageGradeCalculation = ref("")
const errorMessageExportingGrade = ref("")
const errorMessageExportingExamData = ref("")
const errorMessageExportingSubtaskPoints = ref("")
const errorMessageImporting = ref("")
const gradeExportAbortOnIncompleteGradingsAndInconsistencies = ref(true)
const exportAbortOnInconsistencies = ref(true)
const exportAbortOnIncompleteGradings = ref(true)
const exportAbortOnInvalidReassessments = ref(true)
const gradeLimits = ref(null)
const chosenImportField = ref("choose")
const gradingsImport = ref<SubtaskFieldGradingsImport>(null)
const changelog = ref([])

onMounted(async () => {
  await examApi.initialize()

  examPhase.value = await examApi.getExamPhase()

  examTasksData.value = await examApi.getTasksData()

  await refreshExamGradeCalculation()

  await refreshGradings()

});

const handleError = (error, messageRef) => {
  if (error instanceof AppError) {
    messageRef.value = error.message
  } else {
    console.error(error)
    messageRef.value = "Failure due to an internal JavaScript error. If this error persists, contact the service provider."
  }
}

const refreshExamGradeCalculation = async () => {
  examGradeCalculation = await examApi.getExamGradeCalculation()

  gradeLimits.value = examGradeCalculation.gradeLimitsToObject()
}

const refreshGradings = async () => {
  // must be fetched first
  const examineeGradingPoints = await examApi.getGradingPoints()
  console.log("examineeGradingPoints", examineeGradingPoints)

  const examineeSubmissions = await examApi.getSubmissions()

  pairedExamineeGradingSubmissions = new PairedExamineeGradingSubmissions(examineeSubmissions, examineeGradingPoints)
}

const onGradeExportClick = () => {
  errorMessageExportingGrade.value = ""

  try {
    const gradeExport = pairedExamineeGradingSubmissions.exportGrades(examApi.examName, examTasksData.value, examGradeCalculation, gradeExportAbortOnIncompleteGradingsAndInconsistencies.value)

    gradeExport.download()
  } catch (e) {
    handleError(e, errorMessageExportingGrade)
  }
}

const onExamDataExportClick = async () => {
  errorMessageExportingExamData.value = ""
  try {
    const examDataExport = await pairedExamineeGradingSubmissions.exportExamData(examApi.examName, examTasksData.value, examGradeCalculation, exportAbortOnInconsistencies.value, exportAbortOnIncompleteGradings.value, exportAbortOnInvalidReassessments.value)
    examDataExport.download()
  } catch (e) {
    console.log("HERE WE ARE", e)
    handleError(e, errorMessageExportingExamData)
  }
}

const onSubtaskPointsExportClick = () => {
  errorMessageExportingSubtaskPoints.value = ""
  try {
    const gradingsExport = pairedExamineeGradingSubmissions.exportSubtaskPoints(examApi.examName, examTasksData.value)

    gradingsExport.download()
  } catch (e) {
    handleError(e, errorMessageExportingSubtaskPoints)
  }
}

const onGradeCalculationSaveClick = async () => {
  errorMessageGradeCalculation.value = ""

  // first validate and abort if needed
  let previousBetterGradeLimit = null
  for (let [grade, gradeLimit] of examGradeCalculation.gradeLimits.entries()) {
    if (!Object.prototype.hasOwnProperty.call(gradeLimits.value, grade)) {
      errorMessageGradeCalculation.value = "An internal error occurred. Did not save."
      return
    }
    let newValue = gradeLimits.value[grade]
    if ((typeof newValue === 'string' && newValue.trim().length === 0) || !Number.isInteger(Number(newValue))) {
      errorMessageGradeCalculation.value = "The required points value for grade " + grade + " is not a valid integer."
      return
    } else {
      // value is a valid integer, make it a number now
      gradeLimits.value[grade] = Number(newValue)
    }
    if (previousBetterGradeLimit !== null && gradeLimits.value[grade] > previousBetterGradeLimit) {
      errorMessageGradeCalculation.value = "Better grades must always have higher required points."
      return
    }
    previousBetterGradeLimit = gradeLimits.value[grade]
  }

  // then attempt to send the request
  try {
    const httpResponseCode = await examApi.saveExamGradeCalculation(gradeLimits.value)
    if (httpResponseCode === 201) {
      errorMessageGradeCalculation.value = ""
    } else {
      errorMessageGradeCalculation.value = "An unexpected error occurred"
    }
  } catch (e) {
    if (e instanceof AppError) {
      errorMessageGradeCalculation.value = e.message
    } else {
      console.error(e)
      errorMessageGradeCalculation.value = "An unexpected error occurred. Reload the page and try again."
    }
  }

  await refreshExamGradeCalculation()
}

const onImportFileChanged = async (event) => {
  gradingsImport.value = null

  const fileList = event.target.files
  if (fileList.length === 0) {
    errorMessageImporting.value = "No file selected"
    return
  } else if (fileList.length > 1) {
    errorMessageImporting.value = "Cannot import more than one file"
    return
  }

  const file = fileList[0]
  if (file.type !== 'text/csv' || file.size <= 0) {
    errorMessageImporting.value = "Please select a valid CSV file"
    return
  }

  try {
    gradingsImport.value = await SubtaskFieldGradingsImport.fromUploadedFile(chosenImportField.value, file)
  } catch(e) {
    handleError(e, errorMessageImporting)
  }
}

const onImportClick = async () => {
  changelog.value = []

  if (gradingsImport.value === null) {
    errorMessageImporting.value = "There is no data to import"
    return
  }

  try {
    const preparedData = await gradingsImport.value.prepareData(pairedExamineeGradingSubmissions)

    changelog.value = preparedData.changelog

    if (preparedData.savableGradingPoints.length > 0) {
      const responseObj = await examApi.saveGradingPoints(...preparedData.savableGradingPoints)

      if (responseObj.status === 201) {
        changelog.value.push(">>> Import successfully completed")
        await refreshGradings()
      } else if (responseObj.status === 207) {
        if (Object.prototype.hasOwnProperty.call(responseObj, "content") && responseObj.content !== null && typeof responseObj.content === 'object' && Object.prototype.hasOwnProperty.call(responseObj.content, "successful")) {
          for (let [examineeIdentifier, _] of responseObj.content.successful) {
            changelog.value.push("> Successfully imported gradings for " + examineeIdentifier)
          }
          changelog.value.push(">>> Import partially successful (see above)")
        } else {
          changelog.value.push(">>> Import partially successful (no further details provided)")
        }
        await refreshGradings()
      } else if (responseObj.status === 403) {
        errorMessageImporting.value = "Import failed due insufficient permission"
        changelog.value = []
      } else if (responseObj.status === 400) {
        errorMessageImporting.value = "Import failed as the server rejected the request"
        changelog.value = []
      } else {
        errorMessageImporting.value = "Import failed due to an unexpected error"
        changelog.value = []
      }
    }

  } catch (e) {
    handleError(e, errorMessageImporting)
  }
}

const gradingLimitsChanged = computed(() => {
  if (gradeLimits.value === null) {
    return false
  }

  return Array.from(Object.entries(gradeLimits.value)).some(
    ([grade, gradeLimit]) => examGradeCalculation.gradeLimits.get(grade) !== gradeLimit
  )
})


</script>

<template>

  <h4>Grading scale</h4>

  <div v-if="gradeLimits !== null">
    <p v-if="examApi.userHasPermission('update-exam-data:grade-calculation')">
      Use the table below to set the required summarized exam points to be awarded with the corresponding grade.
      The required points cannot be empty and must be integers (no decimal digits).
    </p>
    <p v-else>
      The table below displays the required summarized exam points to be awarded with the corresponding grade.
      You do not have sufficient permission to modify the table contents.
    </p>

    <table>
      <thead>
        <tr>
          <th>Grade</th>
          <th v-for="grade of Object.keys(gradeLimits)">
            {{ grade }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Required points</th>
          <td v-for="grade of Object.keys(gradeLimits)" style="min-width: 8%">
            <template v-if="examPhase === 'grading'">
              <input v-if="grade !== '5.0'"
                     :class="{'save-error': (!Number.isInteger(Number(gradeLimits[grade])) || Number(gradeLimits[grade]) <= 0)}"
                     type="text"
                     v-model="gradeLimits[grade]"
                     :disabled="!examApi.userHasPermission('update-exam-data:grade-calculation')"
                     size="2"
              />
              <input v-else type="text" disabled size="2" :value="gradeLimits[grade]"/>
            </template>
            <span v-else>{{ gradeLimits[grade] }}</span>
          </td>
          <td class="no-border" v-if="examApi.userHasPermission('update-exam-data:grade-calculation')">
            <button @click="onGradeCalculationSaveClick()" class="smaller" :disabled="!gradingLimitsChanged">Save</button>
          </td>
        </tr>
      </tbody>
    </table>

    <MessageContainer type="warn" v-if="examPhase !== 'grading'">
      Due to the current exam phase, the required points for grades cannot be changed anymore.
    </MessageContainer>

    <MessageContainer type="error" v-if="errorMessageGradeCalculation">
      {{ errorMessageGradeCalculation }}
    </MessageContainer>
  </div>

  <h4 class="mt-3">Export data</h4>

  <p>
    Use the following buttons to export the data for the use in other applications.
  </p>

  <div class="mt-2">
    <h5 class="mb-05">Export points and grades for grade management tools</h5>
    <p>
      Use this button to export the exam results containing the final grades as a CSV file.
      The export includes all examinees (except no-shows) with their real name, student ID, achieved points, and final grade.
      This export is only possible once all answers have been fully and consistently graded.
      You can disable this behavior below; in that case, the export is generated despite any missing gradings and potential inconsistencies.
    </p>

    <SettingsToggle description='Validate that the exam has been fully graded and that all gradings are consistent (e.g., achieved points for any subtask do not exceed the allocated points for the same subtask).' v-model:activated="gradeExportAbortOnIncompleteGradingsAndInconsistencies"></SettingsToggle>

    <button @click="onGradeExportClick()">Export grades and points</button>

    <MessageContainer type="error" v-if="errorMessageExportingGrade">
      {{ errorMessageExportingGrade }}
    </MessageContainer>

    <hr />
  </div>

  <div>
    <h5>Export summarized subtask points as CSV</h5>

    <p>
      Use this button to export the summarized points achieved on individual subtasks.
      The export only includes awarded points, not potential points from incomplete gradings, and is always available regardless of grading status.
      Depending on conditions, the points column may show:
      <ul>
        <li><em>LOCKED</em> – you lack permission to view all relevant gradings,</li>
        <li><em>INCONSISTENT</em> – the sum of awarded points exceeds the subtask’s maximum,</li>
        <li>current points with a trailing "+" – some answers are not yet fully graded.</li>
      </ul>
    </p>

    <button @click="onSubtaskPointsExportClick()">Export summarized subtask points as csv</button>

    <MessageContainer type="error" v-if="errorMessageExportingSubtaskPoints">
      {{ errorMessageExportingSubtaskPoints }}
    </MessageContainer>

    <hr />
  </div>

  <div>
    <h5>Export exam data (submissions and gradings) as ZIP archive</h5>
    <p>
      Use this button to export the complete exam data as a ZIP archive.
      The archive includes decrypted submissions for all examinees (including no-shows), their decrypted gradings, and aggregated point files.
      It does <em>not</em> include the exam tasks (templates).
      Since this export is intended for archival, it runs several validation checks, which can be disabled below if needed.
    </p>

    <SettingsToggle description='Validate that all gradings are consistent (e.g., achieved points for any subtask do not exceed the allocated points for the same subtask).' v-model:activated="exportAbortOnInconsistencies"></SettingsToggle>
    <SettingsToggle description='Validate that the exam has been fully graded and that there are no submissions without gradings.' v-model:activated="exportAbortOnIncompleteGradings"></SettingsToggle>
    <SettingsToggle description='Validate that all examinees that failed the exam have a valid and approved reassessment.' v-model:activated="exportAbortOnInvalidReassessments"></SettingsToggle>
    <button @click="onExamDataExportClick()">Export entire exam data (as .zip)</button>

    <MessageContainer type="error" v-if="errorMessageExportingExamData">
      {{ errorMessageExportingExamData }}
    </MessageContainer>
    <hr />
  </div>

</template>

<style scoped>
.flex-gap {
  gap: 1rem;
}

.compact-table {
  line-height: 1;
  font-size: smaller;
}
</style>