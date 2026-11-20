/**
 * NOVA TV 管理后台 · 后台任务
 * 单进程内存任务表：收集、批量探测都走这里，避免重复触发。
 */
export function createJobs() {
  const map = new Map();

  function record(name) {
    if (!map.has(name)) {
      map.set(name, { name, running: false, startedAt: 0, finishedAt: 0, progress: null, result: null, error: "" });
    }
    return map.get(name);
  }

  return {
    isRunning(name) {
      return Boolean(record(name).running);
    },
    start(name, runner) {
      const job = record(name);
      object_assign(job, { running: true, startedAt: Date.now(), finishedAt: 0, progress: null, result: null, error: "" });
      const api = {
        progress(payload) {
          job.progress = { ...payload, at: Date.now() };
        }
      };
      Promise.resolve()
        .then(() => runner(api))
        .then((result) => {
          job.result = result ?? null;
          job.running = false;
          job.finishedAt = Date.now();
        })
        .catch((error) => {
          job.error = String(error?.message || error).slice(0, 300);
          job.running = false;
          job.finishedAt = Date.now();
        });
      return job;
    },
    current(name) {
      const job = record(name);
      return job.running || job.finishedAt ? { ...job } : null;
    },
    summary() {
      return Array.from(map.values()).map((j) => ({ name: j.name, running: j.running, startedAt: j.startedAt, finishedAt: j.finishedAt, error: j.error }));
    }
  };
}

function object_assign(target, patch) {
  Object.keys(patch).forEach((k) => {
    target[k] = patch[k];
  });
}
