<template>
  <div class="rc-section">
    <el-alert type="info" :closable="false" class="rc-alert">
      在自定义JS代码中，通过 <code>data</code> 变量访问绑定的数据。例如: <code>data.list</code>、<code>data.values</code>
    </el-alert>
  </div>
</template>

<style scoped>
.rc-alert {
  margin-bottom: 10px;
}
</style>