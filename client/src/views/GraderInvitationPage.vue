<script setup>
import ExamApi from "@/models/ExamApi";
import {onMounted} from "vue";
import {AppError} from "@/models/AppError";
import NaClCrypto from "@/models/NaClCrypto";

let examApi;

const urlFragment = document.location.hash
if (NaClCrypto.isValidKeyString(urlFragment, true)) {
  // the URL is already fully valid (with master key and private key); redirect to welcome page
  examApi = new ExamApi(true)
  examApi.redirectTo("/grading/welcome", true, true)
} else {
  console.log("no private key was expected")
  examApi = new ExamApi(false)
}

onMounted(async () => {
  // note: Examinees will not get an invitation; invitations are for graders only get an invitation
  //       why? Examinees will only see the post-exam review page. They do not have a private key.

  await examApi.initialize()

  if (examApi.userData.hasPublicSigningKey()) {
    throw new AppError("This invitation link was already used by someone. If this wasn't you, there is a potential security breach. Contact the person that gave you this link.")
  } else {
    examApi.redirectTo("/grading/welcome", true, true)
  }
});


</script>

<template>
  <p>
    You will be redirected soon ...
  </p>

</template>

<style scoped>

</style>