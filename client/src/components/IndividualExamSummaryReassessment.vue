<script setup lang="ts">

import { useGradingStore } from "@/individual-grading-store";
import ExamApi from "@/models/ExamApi";
import {computed, inject, onMounted, ref} from "vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import MessageContainer from "@/components/base/MessageContainer.vue";
import {ExamTasksData} from "@/models/ExamTaskData";
import {ValidPublicSigningKeys} from "@/models/ExamineeGradingPoints";
import {IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {AppError} from "@/models/AppError";
import {ExamGradeCalculation} from "@/models/ExamGradeCalculation";

interface Props {
  examTasksData: ExamTasksData
  examPhase: string
  validPublicKeys: ValidPublicSigningKeys
  examGradeCalculation: ExamGradeCalculation
  examineeIdentifier: string
  examineeSubmissions: IndividualExamineeSubmissions
}

const props = defineProps<Props>()

const gradingStore = useGradingStore()

const examApi: ExamApi = inject<ExamApi>('examApi')

const isReassessmentValid = ref(null)
const savingErrorMessage = ref("")

const isGradingCompleteAndConsistent = computed(() => {
  const summarizedExamPoints = gradingStore.getSummarizedExamPoints(props.examTasksData, props.examGradeCalculation)
  return summarizedExamPoints.allGradingsDone && !summarizedExamPoints.inconsistentGradings
})

const userCouldGradeExaminee = computed(() => {
  for (let gradingPoints of gradingStore.getContent().gradingPoints.values()) {
    let permission = "upload-grading-points:" + props.examineeIdentifier + ":" + gradingPoints.mappedFileName
    if (examApi.userHasPermission(permission)) {
      return true
    }
  }
  return false
})

function summarizedExamPoints() {
  return gradingStore.getSummarizedExamPoints(props.examTasksData, props.examGradeCalculation)
}

const onApproveClick = async () => {
  const reassessmentResult = gradingStore.getContent().getReassessmentResult()

  if (reassessmentResult.isLocked()) {
    throw new AppError("Cannot change locked reassessment result")
  }

  reassessmentResult.answerFilesHashHex = props.examineeSubmissions.answerFilesHashHex
  reassessmentResult.gradingFilesHashHex = await gradingStore.getContent().calculateHashOverGradings(examApi.examName)
  reassessmentResult.approved = true

  console.log("updated reassessmentResult", reassessmentResult)

  try {
    const httpResponseCode = await examApi.saveReassessmentResult(reassessmentResult)
    if (httpResponseCode === 201) {
      savingErrorMessage.value = ""
      isReassessmentValid.value = true
    } else {
      savingErrorMessage.value = "An unexpected error occurred"
    }
  } catch (error) {
    if (error instanceof AppError) {
      savingErrorMessage.value = error.message
    } else {
      console.error(error)
      savingErrorMessage.value = "An unhandled error occurred. Reload the page, and if the issue persists, contact support"
    }
  }

}

onMounted(async () => {
  let currentGradingFilesHashHex = await gradingStore.getContent().calculateHashOverGradings(examApi.examName)

  if (!gradingStore.getContent().getReassessmentResult().isLocked()) {
    isReassessmentValid.value = gradingStore.getContent().getReassessmentResult().isValid(props.validPublicKeys, currentGradingFilesHashHex, props.examineeSubmissions.answerFilesHashHex)
  }
})

</script>

<template>

  <div class="reassessment-container mt-1" v-if="examPhase !== 'grading' && !summarizedExamPoints().somePointsLocked && !summarizedExamPoints().alreadyPassed">
    <div v-if="!gradingStore.getContent().getReassessmentResult().isLocked()">
      <template v-if="gradingStore.getContent().getReassessmentResult().isApproved() && isReassessmentValid">
        <strong>
          <i class="ri-award-fill fs-150"/>
          Gradings and awarded points have been reassessed by second grader.
        </strong>
      </template>
<!--      <template v-else-if="isReassessmentValid">-->
<!--        REASSESSMENT GRADER DOES NOT APPROVE BUT IT IS VALID-->
<!--      </template>-->
      <div v-else>
        <strong>
          <i class="ri-edit-line fs-150"></i>
          Reassessment is pending.
        </strong>

        <div v-if="examApi.userHasPermission('upload-reassessment-result:' + examineeIdentifier) && examPhase === 'reassessment' && isGradingCompleteAndConsistent">
          <!-- User CAN do the reassessment -->
          <div v-if="!userCouldGradeExaminee">
            <p>
              You are an reassessment grader.
              By pressing the <em>Approve gradings</em> button, you sign that the displayed gradings and awarded points are appropriate for the given examinee's answers.
              This step cannot be undone.
            </p>
            <button @click="onApproveClick()"><i class="ri-award-fill"></i> Approve gradings (cannot be undone)</button>
          </div>
          <p v-else>
            While you are an reassessment grader, you also have the permission to grade the answers of this examinee, hence, you cannot do the reassessment.
          </p>
        </div>
        <MessageContainer v-else-if="!isGradingCompleteAndConsistent" type="error">
          There is an error with the current phase of the exam. Please contact an administrator.
        </MessageContainer>

        <MessageContainer type="error" v-if="savingErrorMessage.length !== 0">
          {{ savingErrorMessage }}
        </MessageContainer>
      </div>
    </div>
    <div v-else>
      <strong><LockedIcon /> Insufficient permissions to view reassessment result.</strong>
    </div>
  </div>
</template>

<style scoped>

div.reassessment-container {
  border-radius: var(--standard-border-radius);
  padding: 0.4rem 0.8rem;
  background: var(--material-ui-info-dark);
  color: white;
}

</style>