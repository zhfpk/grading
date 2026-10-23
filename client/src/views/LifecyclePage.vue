<script setup lang="ts">
import ExamApi from "@/models/ExamApi";
import {computed, onMounted, ref, watch} from "vue";
import {IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {ExamGradingProgress, ExamineeGradingPoints, IndividualExamineeGradingPoints, SummarizedExamPoints} from "@/models/ExamineeGradingPoints";
import SettingsToggle from "@/components/base/SettingsToggle.vue";
import {LocalStorageSettings} from "@/models/Enums";
import OverviewExamineeTableRow from "@/components/OverviewExamineeTableRow.vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import {ExamTasksData} from "@/models/ExamTaskData";
import {PairedExamineeGradingSubmissions} from "@/models/PairedExamineeGradingSubmissions";
import MessageContainer from "@/components/base/MessageContainer.vue";
import {GRADER_TYPES} from "@/models/PermissionsUI";
import LoadingIndicator from "@/components/base/LoadingIndicator.vue";
import FailedIcon from "@/components/base/FailedIcon.vue";

const isLoading = ref<Boolean>(true)
const errorMessage = ref(null)
let examineeGradingPoints: ExamineeGradingPoints = null
let examTasksData: ExamTasksData = null
const currentExamPhase = ref(null)
const examGradingProgress = ref(null)


const examApi = new ExamApi()

onMounted(async () => {
  await examApi.initialize()

  examTasksData = await examApi.getTasksData()

  currentExamPhase.value = await examApi.getExamPhase()

  examineeGradingPoints = await examApi.getGradingPoints()
  console.log("examineeGradingPoints", examineeGradingPoints)

  const examineeSubmissions = await examApi.getSubmissions()

  let pairedExamineeGradingSubmissions = new PairedExamineeGradingSubmissions(examineeSubmissions, examineeGradingPoints)
  examGradingProgress.value = pairedExamineeGradingSubmissions.getGradingProgress(examTasksData)

  isLoading.value = false
});

const clickOnStartPhase = async (phase: string) => {
  errorMessage.value = null

  try {
    currentExamPhase.value = await examApi.setExamPhase(phase)
  } catch (e) {
    errorMessage.value = e.message
  }
}

</script>

<template>

  <p>
    You can use this page to progress through the grading lifecycle of an exam.
    The classical lifecycle includes the actual grading phase, the reassessment through a second grader, and the exam inspection through examinees.
    You can configure the active exam phase below.
  </p>

  <LoadingIndicator v-if="currentExamPhase === null"></LoadingIndicator>
  <div v-else class="flex-row">
    <div class="exam-phase-container right-border">
      <div :class="{'faded': currentExamPhase !== 'grading'}">
        <strong>Grading phase <span v-if="currentExamPhase === 'grading'">(active)</span></strong>
        <ul class="my-0 mx-0 pl-2">
          <li>Graders are grading the examinees' submissions.</li>
          <li>No reassessments through a second grader (yet).</li>
          <li>No exam inspection through examinees (yet).</li>
        </ul>
      </div>
      <div v-if="currentExamPhase !== 'grading'">
        <hr />
        <div v-if="examApi.userHasPermission('manage-lifecycle:change-phase')">
          <button @click="clickOnStartPhase('grading')">Fall back to grading phase</button>
          <MessageContainer type="warn">This requires an additional reassessment if gradings are modified.</MessageContainer>
        </div>
        <span v-else><LockedIcon /> Insufficient permissions to alter phase.</span>
      </div>
    </div>

    <div class="exam-phase-container right-border">
      <div :class="{'faded': currentExamPhase !== 'reassessment'}">
        <strong>Reassessment phase <span v-if="currentExamPhase === 'reassessment'">(active)</span></strong>
        <ul class="my-0 mx-0 pl-2">
          <li>All submissions must be graded completely.</li>
          <li>No inconsistent gradings allowed.</li>
          <li>Further grading is prohibited.</li>
          <li>Reassessment grader verifies gradings of failed examinees.</li>
        </ul>
      </div>
      <div v-if="currentExamPhase !== 'reassessment'">
        <hr />
        <LoadingIndicator v-if="examGradingProgress === null" />
        <div v-else-if="examApi.userHasPermission('manage-lifecycle:change-phase') || examGradingProgress.somePointsLocked">
          <button @click="clickOnStartPhase('reassessment')" v-if="examGradingProgress.allGradingsDone && !examGradingProgress.inconsistentGradings">Start Reassessment phase</button>
          <span v-else><FailedIcon /> Cannot change to this phase: Not all exams have been graded yet or there might still be inconsistent gradings.</span>
        </div>
        <span v-else><LockedIcon /> Insufficient permissions to alter phase.</span>
      </div>
      <MessageContainer type="info" v-else>Make sure to add a reassessment grader and invite her/him!</MessageContainer>
    </div>


    <div class="exam-phase-container">
      <div :class="{'faded': currentExamPhase !== 'review'}">
        <strong>Exam review phase <span v-if="currentExamPhase === 'review'">(active)</span></strong>
        <ul class="my-0 mx-0 pl-2">
          <li>All submissions must be graded completely.</li>
          <li>No inconsistent gradings allowed.</li>
          <li>Further grading is prohibited.</li>
          <li>Examinees inspect their exam results (further details in <em>Post-Exam Review</em>)</li>
        </ul>
      </div>
      <div v-if="currentExamPhase !== 'review'">
        <hr />
        <LoadingIndicator v-if="examGradingProgress === null" />
        <div v-else-if="examApi.userHasPermission('manage-lifecycle:change-phase') || examGradingProgress.somePointsLocked">
          <button @click="clickOnStartPhase('review')" v-if="examGradingProgress.allGradingsDone && !examGradingProgress.inconsistentGradings">Start Review phase</button>
          <span v-else><FailedIcon /> Cannot change to this phase: Not all exams have been graded yet or there might still be inconsistent gradings.</span>
        </div>
        <span v-else><LockedIcon /> Insufficient permissions to alter phase.</span>
      </div>
    </div>
  </div>

  <MessageContainer type="error" v-if="errorMessage !== null">
    {{ errorMessage }}
  </MessageContainer>

</template>

<style scoped>

.exam-phase-container {
    flex-grow: 1;
    max-width: 33.4%;
    padding: 0.2rem 0.5rem;
}

.right-border {
    border-right: 2px gray solid;
}

.faded {
  opacity: 70%;
}

i.ri-close-large-fill {
  color: red;
}

</style>
