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
import {AppError} from "@/models/AppError";

const editTimeframeErrorMessage = ref(null)
const downloadLinksErrorMessage = ref(null)
const downloadIsLoading = ref<Boolean>(false)
const currentExamPhase = ref(null)
const examReviewConfig = ref(null)
const datesChanged = ref(false)
const timeframeFrom = ref<string>("")
const timeframeUntil = ref<string>("")

const examApi = new ExamApi()

onMounted(async () => {
  await examApi.initialize()

  currentExamPhase.value = await examApi.getExamPhase()

  await refreshReviewConfig()

});

const refreshReviewConfig = async () => {
  examReviewConfig.value = await examApi.getReviewConfig()
  timeframeFrom.value = examReviewConfig.value.timeframeFrom
  timeframeUntil.value = examReviewConfig.value.timeframeUntil
}

const clickOnSaveTimeFrame = async () => {
  editTimeframeErrorMessage.value = null

  try {
    await examApi.setReviewConfig(timeframeFrom.value, timeframeUntil.value)
    await refreshReviewConfig()
    datesChanged.value = false
  } catch (e) {
    if (e instanceof AppError) {
      editTimeframeErrorMessage.value = e.message
    } else {
      editTimeframeErrorMessage.value = "An unhandled error occurred while saving the timeframe for the review. Please try again later."
    }
  }
}

const clickOnDownloadReviewLinks = async () => {
  downloadLinksErrorMessage.value = null
  downloadIsLoading.value = true

  try {
    const examineeSubmissionsPromise = examApi.getSubmissions()
    const examineeGradingPointsPromise = examApi.getGradingPoints()

    const [examineeSubmissions, examineeGradingPoints] = await Promise.all([examineeSubmissionsPromise, examineeGradingPointsPromise])

    const paired = new PairedExamineeGradingSubmissions(examineeSubmissions, examineeGradingPoints)

    const csvExport = paired.exportPostExamReviewInviteLinks(examApi)
    csvExport.download()
  } catch (e) {
    if (e instanceof AppError) {
      downloadLinksErrorMessage.value = e.message
    } else {
      console.error(e)
      downloadLinksErrorMessage.value = "An unhandled error occurred while downloading the review links. Please try again later."
    }
  }
  downloadIsLoading.value = false
}

</script>

<template>

  <LoadingIndicator v-if="currentExamPhase === null"></LoadingIndicator>
  <div v-else>

    <div class="mt-1 mb-1">
      <MessageContainer v-if="currentExamPhase !== 'review'" type="warn">
        The exam is currently <strong>not</strong> in the <em>review phase</em>.
        Hence, examinees will not be able to inspect their exam results.
        Use the <em>Exam Lifecycle</em> option in the menu to change the current exam phase.
      </MessageContainer>
      <MessageContainer v-else type="info">
        The exam is currently in the the review phase. Examinees may use their custom review links to view their exam results.
      </MessageContainer>
    </div>

    <h5 class="mb-0">Edit timeframe</h5>


    <template v-if="examReviewConfig !== null">
      <p>
        Edit the timeframe during which examinees can view their exam results.
        Examinees can only review their exam results during this timeframe <strong>and</strong> when the exam is in <em>review phase</em>.
        Currently, examinees
        <span v-if="examReviewConfig.reviewAllowed" class="success">can inspect</span>
        <span v-else class="error">cannot inspect</span>
        their exam results.
      </p>
      <div class="flex-row flex-gap-2">
        <div>
          <label for="timeframeFrom">Start date of the review timeframe (start of day)</label>
          <input id="timeframeFrom" type="date" v-model="timeframeFrom" @change="datesChanged=true"/>
        </div>
        <div>
          <label for="timeframeUntil">End date of the review timeframe (end of day)</label>
          <input id="timeframeUntil" type="date" v-model="timeframeUntil" @change="datesChanged=true"/>
        </div>
        <div>
          <button @click="clickOnSaveTimeFrame" :disabled="!datesChanged">Save</button>
        </div>
      </div>
      <div class="smaller">
        <span>Current server time: {{ examReviewConfig.serverTime }}</span>
      </div>
    </template>
    <LoadingIndicator v-else />
    <MessageContainer type="error" v-if="editTimeframeErrorMessage !== null">
      {{ editTimeframeErrorMessage }}
    </MessageContainer>

    <h5>Review links for examinees</h5>

    <p>
      Use the button below to download the personalized review link (as csv file) for all examinees.
      Each review link contains the personalized credentials for viewing the exam results of the respective examinee.
      Anyone with an examinee's review link may inspect their exam results.
      Currently, it is not possible to revoke access for an individual examinee after the review link has been shared.
    </p>
    <p>
      To obtain the personalized review link for a specific examinee, you may also use the share button <i class="ri-share-fill"></i> in the <em>Overview</em> page (see menu).
      This share button is only available when the exam is in the <em>review phase</em> (see <em>Exam Lifecycle</em> in the menu).
    </p>

    <div>
      <button @click="clickOnDownloadReviewLinks" v-if="!downloadIsLoading">Download review links (as csv)</button>
      <LoadingIndicator v-else></LoadingIndicator>
    </div>
    <MessageContainer type="error" v-if="downloadLinksErrorMessage !== null">
      {{ downloadLinksErrorMessage }}
    </MessageContainer>


  </div>

</template>

<style scoped>

</style>
