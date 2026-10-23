<script setup lang="ts">

import {getQueryParameters} from "@/models/ExamApi";
import {onMounted, ref} from "vue";

const visible = ref<boolean>(false)
const text = ref<string>("")
const bgClass = ref<string>("")
const colorClass = ref<string>("")

const colorStates = [
  { background: "bg-1", color: "c-1" },
  { background: "bg-1", color: "c-2" },
  { background: "bg-1", color: "c-4" },
  { background: "bg-1", color: "c-5" },
  { background: "bg-1", color: "c-6" },
  { background: "bg-1", color: "c-7" },
  { background: "bg-2", color: "c-1" },
  { background: "bg-2", color: "c-2" },
  { background: "bg-2", color: "c-4" },
  { background: "bg-2", color: "c-5" },
  { background: "bg-2", color: "c-7" },
  { background: "bg-3", color: "c-3" },
  { background: "bg-3", color: "c-4" },
  { background: "bg-3", color: "c-5" },
  { background: "bg-3", color: "c-7" },
  { background: "bg-4", color: "c-1" },
  { background: "bg-4", color: "c-2" },
  { background: "bg-4", color: "c-3" },
  { background: "bg-4", color: "c-4" },
  { background: "bg-4", color: "c-5" },
  { background: "bg-4", color: "c-6" },
  { background: "bg-4", color: "c-7" },
  { background: "bg-5", color: "c-2" },
  { background: "bg-5", color: "c-4" },
  { background: "bg-5", color: "c-5" },
  { background: "bg-5", color: "c-7" },
  { background: "bg-6", color: "c-8" },
  { background: "bg-6", color: "c-9" },
  { background: "bg-6", color: "c-10" },
  { background: "bg-7", color: "c-8" },
  { background: "bg-7", color: "c-9" },
  { background: "bg-7", color: "c-10" },
  { background: "bg-8", color: "c-8" },
  { background: "bg-8", color: "c-9" },
  { background: "bg-8", color: "c-10" },
  { background: "bg-9", color: "c-7" },
  { background: "bg-9", color: "c-8" },
  { background: "bg-10", color: "c-8" },
  { background: "bg-10", color: "c-9" },
  { background: "bg-10", color: "c-10" }
]

const textStates = [
  "This link contains your personal login details. Do not share it.",
  "This is a private link. Keep it to yourself.",
  "This link is unique to you. Do not share it with anyone.",
  "Private link. Sharing it gives others access to your data.",
  "This link has your login built in. Keep it safe and do not share it.",
  "This link contains your personal login details. Anyone who opens it can access your data. Do not share it.",
  "This link is tied to your account. Do not share it.",
  "You are viewing a private link. It contains login details that are unique to you. Do not share.",
  "Do not share this link. It contains your personal login details.",
  "This link contains sensitive login information. Keep it private.",
  "Do not share this link. Anyone who has it can log in as you.",
  "This link grants access to your data. Treat it as confidential."
]


onMounted(() => {
  const queryParameters = getQueryParameters()

  if (queryParameters.has('uuid') || document.location.hash.length > 0) {
    visible.value = true
    // note: no need for cryptographically secure randomness => Math.random is sufficient
    let colorIdx = Math.floor(Math.random() * colorStates.length)
    let textIdx = Math.floor(Math.random() * textStates.length)

    bgClass.value = colorStates[colorIdx].background
    colorClass.value = colorStates[colorIdx].color
    text.value = textStates[textIdx]
  }
})

</script>

<template>
  <div v-if="visible" :class="[colorClass, bgClass]" class="px-1 py-025 text-align-center">
    {{ text }}
  </div>
</template>

<style scoped>
.bg-1  { background-color: #FFF3CD; }
.bg-2  { background-color: #F8D7DA; }
.bg-3  { background-color: #D1ECF1; }
.bg-4  { background-color: #FFF8F0; }
.bg-5  { background-color: #E8EAF6; }
.bg-6  { background-color: #1A1A2E; }
.bg-7  { background-color: #2D2D2D; }
.bg-8  { background-color: #B71C1C; }
.bg-9  { background-color: #E65100; }
.bg-10 { background-color: #4A148C; }

.c-1  { color: #856404; }
.c-2  { color: #721C24; }
.c-3  { color: #0C5460; }
.c-4  { color: #4A235A; }
.c-5  { color: #283593; }
.c-6  { color: #7B3F00; }
.c-7  { color: #212121; }
.c-8  { color: #FFFFFF; }
.c-9  { color: #FFD600; }
.c-10 { color: #E0E0E0; }
</style>