<script setup>
import { ref, computed, onMounted } from 'vue';
const api = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const tasks = ref([]), title = ref(''), error = ref(''), busy = ref(false), loading = ref(true);
const completed = computed(() => tasks.value.filter(t => t.completed).length);
async function request(path, options = {}) {
  if (!api) throw new Error('Falta configurar la dirección de la API.');
  const response = await fetch(api + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'No se pudo completar la operación.'); }
  return response.status === 204 ? null : response.json();
}
async function load() { const data = await request('/tasks'); tasks.value = data.items; }
async function action(fn) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await fn(); } catch (e) { error.value = e.name === 'TimeoutError' ? 'La conexión tardó demasiado. Intenta de nuevo.' : e instanceof TypeError ? 'No se pudo conectar con el servidor. Intenta de nuevo en unos momentos.' : e.message; }
  finally { busy.value = false; loading.value = false; }
}
async function add() { await action(async () => { await request('/tasks', { method: 'POST', body: JSON.stringify({ title: title.value }) }); title.value = ''; await load(); }); }
async function toggle(task) { await action(async () => { await request('/tasks/' + task._id, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }); await load(); }); }
async function remove(task) { if (!confirm('¿Eliminar esta tarea?')) return; await action(async () => { await request('/tasks/' + task._id, { method: 'DELETE' }); await load(); }); }
onMounted(() => action(load));
</script>
<template>
  <main>
    <header><p class="eyebrow">APLICACIONES WEB · UNIDAD 4</p><h1>Mis tareas académicas</h1><p>Organiza tus pendientes y registra tu avance.</p></header>
    <section class="stats" aria-label="Resumen de tareas"><div><strong>{{ tasks.length }}</strong><span>Tareas recientes</span></div><div><strong>{{ tasks.length - completed }}</strong><span>Pendientes</span></div><div><strong>{{ completed }}</strong><span>Completadas</span></div></section>
    <section class="panel"><h2>Agregar una tarea</h2><form @submit.prevent="add"><label for="title">Título de la tarea</label><div class="form-row"><input id="title" v-model="title" required maxlength="120" placeholder="Por ejemplo, revisar el despliegue" :disabled="busy"><button :disabled="busy || !title.trim()">Agregar</button></div></form></section>
    <p v-if="error" class="error" role="alert">{{ error }} <button class="text-button" :disabled="busy" @click="action(load)">Reintentar</button></p>
    <section class="panel"><div class="list-heading"><h2>Últimas 100 tareas</h2><button class="text-button" :disabled="busy" @click="action(load)">Actualizar</button></div>
      <p v-if="loading" role="status">Cargando tareas…</p><p v-else-if="!tasks.length" class="empty">Aún no hay tareas. Agrega tu primer pendiente.</p>
      <ul v-else><li v-for="task in tasks" :key="task._id"><label class="task"><input type="checkbox" :checked="task.completed" :disabled="busy" @change="toggle(task)"><span :class="{ done: task.completed }">{{ task.title }}</span></label><button class="delete" :disabled="busy" :aria-label="'Eliminar ' + task.title" @click="remove(task)">Eliminar</button></li></ul>
    </section><footer>Demostración académica compartida. Usa únicamente datos de prueba.</footer>
  </main>
</template>
