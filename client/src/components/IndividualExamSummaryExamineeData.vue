<script setup lang="ts">
import {ExamineeSubmissions, IndividualExamineeSubmissions} from "@/models/ExamineeSubmissions";
import {inject, ref} from "vue";
import LockedIcon from "@/components/base/LockedIcon.vue";
import Hidable from "@/components/base/Hidable.vue";
import {LocalStorageSettings} from "@/models/Enums";

interface Props {
  examineeSubmissions: IndividualExamineeSubmissions
}

const props = defineProps<Props>()

const keepExamineeDataOpen = ref<boolean>(window.localStorage.getItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_EXAMINEE_DATA_OPEN) !== null ? window.localStorage.getItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_EXAMINEE_DATA_OPEN) == 'true' : false)

const onKeepExamineeDataOpenClick = () => {
  window.localStorage.setItem(LocalStorageSettings.UI_INDIVIDUAL_KEEP_EXAMINEE_DATA_OPEN, keepExamineeDataOpen.value === true ? 'true' : 'false')
}

</script>

<template>
  <details class="small" :open="keepExamineeDataOpen">
    <summary>Examinee data</summary>
    <div>
      <ul class="my-0">
        <li>Anonymized name: {{ examineeSubmissions.getAnonymizedName() }}</li>
        <template v-if="examineeSubmissions.isPersonalDataLocked()">
          <li>Personal data: <LockedIcon /> Locked (insufficient permissions)</li>
        </template>
        <template v-else>
          <li>Real name: <Hidable>{{ examineeSubmissions.getRealName(true) }}</Hidable></li>
          <li>Matriculation number: <Hidable>{{ examineeSubmissions.personalData.studentId }}</Hidable></li>
          <li>Seat number: <Hidable>{{ examineeSubmissions.personalData.seatNumber }}</Hidable></li>
        </template>
      </ul>
      <div class="text-align-right keep-open-container">
        <span>Keep open</span> <input @change="onKeepExamineeDataOpenClick" type="checkbox" v-model="keepExamineeDataOpen">
      </div>
    </div>
  </details>
</template>

<style scoped>
ul {
  margin-top: 0;
}
</style>