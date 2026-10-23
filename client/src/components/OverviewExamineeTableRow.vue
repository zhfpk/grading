<script setup lang="ts">

import ExamApi from "@/models/ExamApi";
import {inject, nextTick, onMounted, watch} from "vue";
import {ExamineeSubmissions, IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {
  ExamineeGradingPoints,
  IndividualExamineeGradingPoints,
  PostExamReviewData,
  SummarizedExamPoints
} from "@/models/ExamineeGradingPoints";
import LockedIcon from "@/components/base/LockedIcon.vue";
import FailedIcon from "@/components/base/FailedIcon.vue";
import PassedIcon from "@/components/base/PassedIcon.vue";
import AnnotationsIcon from "@/components/base/AnnotationsIcon.vue";
import ClipboardButton from "@/components/base/ClipboardButton.vue";
import StrikethroughIcon from "@/components/base/StrikethroughIcon.vue";
import NoShowIcon from "@/components/base/NoShowIcon.vue";
import CompletedIcon from "@/components/base/CompletedIcon.vue";

interface Props {
  examineeSubmissions: IndividualExamineeSubmissions
  summarizedExamPoints: SummarizedExamPoints
  showRealNames: boolean
  hasGradingAnnotations: boolean
  examPhase: string
  reassessmentValid: boolean
  postExamReviewData: PostExamReviewData
  examApi: ExamApi
}

const props = defineProps<Props>()

</script>

<template>
  <tr>
    <td>
      <AnnotationsIcon v-if="hasGradingAnnotations" />
      <a :href="examApi.buildIndividualGradingURL(examineeSubmissions.examineeIdentifier)">
        <span v-if="showRealNames === false">
          {{ examineeSubmissions.getAnonymizedName() }}
        </span>
        <template v-else>
          <span v-if="examineeSubmissions.isPersonalDataLocked()">( {{ examineeSubmissions.getAnonymizedName() }} )</span>
          <span v-else>{{ examineeSubmissions.getRealName(true) }}</span>
        </template>
      </a>
      <span v-if="showRealNames && examineeSubmissions.isPersonalDataLocked()">
        &nbsp;<LockedIcon/> Insufficient permission
      </span>
    </td>
    <td>
      <span v-if="examineeSubmissions.isNoShow()">
        <NoShowIcon title="Examinee fails exams (no-show)" color="info"/> No-show (5.0)
      </span>
      <span v-else-if="examineeSubmissions.isNoGradingChosen()">
        <StrikethroughIcon title="Examinee decided to submit blank for the entire exam (no-grading is active)" color="warn"/> Blank (5.0)
      </span>
      <span v-else>
        <PassedIcon v-if="summarizedExamPoints.alreadyPassed"/>
        <FailedIcon title="Examinee currently fails exam" v-else/>
        {{ summarizedExamPoints.achievedPoints }}
        ({{ summarizedExamPoints.achievedGrade }})
        <sup v-if="summarizedExamPoints.somePointsLocked">[1]</sup>
      </span>
    </td>
    <td v-if="examPhase === 'grading'">
      <span v-if="examineeSubmissions.isNoShow() || examineeSubmissions.isNoGradingChosen() || summarizedExamPoints.allGradingsDone">
        &ndash;
      </span>
      <span v-else>
        {{ summarizedExamPoints.possiblePoints }} ({{ summarizedExamPoints.possibleGrade }})
        <sup v-if="summarizedExamPoints.somePointsLocked">[1]</sup>
      </span>
    </td>
    <td>
      <span v-if="summarizedExamPoints.inconsistentGradings" class="error">
        <i class="ri-error-warning-line"></i>&nbsp;Inconsistent
      </span>
      <span v-else-if="summarizedExamPoints.allGradingsDone" class="success">
        <CompletedIcon :completed="true"/>&nbsp;Done
      </span>
      <span v-else>
        <CompletedIcon :completed="false"/>&nbsp;Todo
      </span>
      <span v-if="hasGradingAnnotations" >
        <AnnotationsIcon />&nbsp;Annotated
      </span>
    </td>
    <td v-if="examPhase !== 'grading'">
      <span v-if="summarizedExamPoints.alreadyPassed || examineeSubmissions.isNoShow()">
        &ndash;
      </span>
      <span v-else-if="reassessmentValid === null">
        <LockedIcon /> Locked
      </span>
      <span v-else-if="reassessmentValid === true" class="success">
        <CompletedIcon :completed="true"/> Done
      </span>
      <span v-else>
        <CompletedIcon :completed="false"/> Pending
      </span>
    </td>
    <td v-if="examPhase === 'review'">
      <span v-if="examineeSubmissions.isNoShow()">
        &ndash;
      </span>
      <template v-else>
        <LockedIcon v-if="postExamReviewData.isReviewAccessedLocked() && postExamReviewData.areCredentialsLocked()" title="Insufficient permissions" />
        <template v-if="!postExamReviewData.isReviewAccessedLocked()">
          <span v-if="postExamReviewData.isReviewAccessed()" class="info">
            <i class="ri-eye-line"></i> Reviewed
          </span>
          <span v-else class="faded">
            <i class="ri-eye-off-line"></i> Not seen
          </span>
        </template>
        <ClipboardButton v-if="!postExamReviewData.areCredentialsLocked()" hint="Share" :text="examApi.buildPostExamReviewInviteURL(postExamReviewData.examineeIdentifier, postExamReviewData.getExamineeUuid(), postExamReviewData.getExamineeMasterKey())" icon="ri-share-fill"></ClipboardButton>
      </template>

    </td>
  </tr>
</template>

<style scoped>

</style>