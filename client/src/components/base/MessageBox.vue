<script setup lang="ts">

</script>

<template>
  <div class="box">
    <div class="heading">
      <slot name="heading"></slot>
    </div>
    <div class="content">
      <slot name="content"></slot>
    </div>
  </div>
</template>

<style scoped>

.box {

}

.heading {
  border-top: 2px solid var(--material-ui-info-light);
  border-right: 2px solid var(--material-ui-info-light);
  border-left: 2px solid var(--material-ui-info-light);
  background: var(--material-ui-info-light);
  color: white;
  padding: 0.4rem 0.7rem;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}

.content {
  padding: 0.4rem 0.7rem;
  border-right: 2px solid var(--material-ui-info-light);
  border-left: 2px solid var(--material-ui-info-light);
  border-bottom: 2px solid var(--material-ui-info-light);
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

@media (prefers-color-scheme: dark) {
  .content, .heading {
    border-color: var(--material-ui-info-light);
  }
}


</style>