<script setup lang="ts">
import ExamApi from "@/models/ExamApi";
import {onMounted, ref} from "vue";
import {AppError} from "@/models/AppError";
import {getQueryParameters} from "@/models/ExamApi";
import LoadingIndicator from "@/components/base/LoadingIndicator.vue";
import {IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import MessageContainer from "@/components/base/MessageContainer.vue";

const examApi: ExamApi = new ExamApi(false)
const examTasksData = ref(null)
const thisExamineesSubmissions = ref<IndividualExamineeSubmissions>(null)
let selectedExamineeIdentifier = null

onMounted(async () => {
  // note: Examinees will not get an invitation; invitations are for graders only get an invitation
  //       why? Examinees will only see the post-exam review page. They do not have a private key.

  await examApi.initialize()

  const queryParameters: Map<string, string> = getQueryParameters()
  if (!queryParameters.has("examinee")) {
    throw new AppError("No examinee specified")
  }
  selectedExamineeIdentifier = queryParameters.get('examinee')

  examTasksData.value = await examApi.getTasksData()

  const examineeSubmissions = await examApi.getSubmissions()
  if (!examineeSubmissions.hasSubmissionsOf(selectedExamineeIdentifier)) {
    throw new AppError("You are not allowed to review the exam results of this examinee!")
  }

  thisExamineesSubmissions.value = examineeSubmissions.getSubmissionsOf(selectedExamineeIdentifier)

  console.log(thisExamineesSubmissions.value)
});

const redirectToReviewPage = () => {
  examApi.redirectTo('/review/perform-review', true, true, new Map<string, string>([['examinee', selectedExamineeIdentifier]]))
}

</script>

<template>
  <LoadingIndicator v-if="thisExamineesSubmissions === null" />
  <div v-else>
    <h5 class="mb-0">Hello {{ thisExamineesSubmissions.getRealName() }}!</h5>
    <p class="mt-1">
      You have been invited to review your exam results for
      <template v-if="examTasksData !== null && examTasksData.examName !== null">
        <em>{{ examTasksData.examName }}</em> ({{examApi.examName}})<span v-if="examTasksData.examDate">, held on {{examTasksData.examDate}}</span>
      </template>
      <em v-else>{{ examApi.examName }}</em>.

      For this exam, your pseudonym is <em>{{ thisExamineesSubmissions.getAnonymizedName() }}</em>, randomly generated from a positive adjective and one of our favorite animals.
      When the exam organizer used anonymous grading, graders only saw your pseudonym instead of your real name.
    </p>
    <p>
      To accept this invitation, please click the button below.
      We will record whether or not you participated in this review.
    </p>

    <MessageContainer type="warn">Do not share this link with anyone! Anyone with access to this link can inspect your exam results.</MessageContainer>

    <button class="mt-2" @click="redirectToReviewPage">&raquo; Click here to view your exam results</button>

  </div>
</template>

<style scoped>

</style>