/**
 * NOVA TV 管理后台 · 持久化层
 * 纯 JSON 文件 + 原子写 + .bak 轮转 + JSONL 追加日志，零依赖。
 */
import fs from "node:fs";
import path from "node:path";

const BAK_KEEP = 5;

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });

  const fileOf = (name) => path.join(dir, name);

  function readRaw(name) {
    try {
      return fs.readFileSync(fileOf(name), "utf8");
    } catch (_) {
      return null;
    }
  }

  function readJson(name, fallback) {
    const raw = readRaw(name);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      // 文件坏了就退回备份，别让整个后台起不来
      const bak = readRaw(name + ".bak");
      if (bak) {
        try {
          return JSON.parse(bak);
        } catch (_e) {
          /* ignore */
        }
      }
      return fallback;
    }
  }

  function writeJson(name, data) {
    const target = fileOf(name);
    const tmp = target + ".tmp";
    const text = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmp, text, "utf8");
    // 原子替换前留一份备份
    try {
      if (fs.existsSync(target)) {
        fs.copyFileSync(target, target + ".bak");
      }
    } catch (_) {
      /* 备份失败不阻塞写入 */
    }
    fs.renameSync(tmp, target);
    return text.length;
  }

  function appendJsonl(name, record) {
    fs.appendFileSync(fileOf(name), JSON.stringify(record) + "\n", "utf8");
  }

  function readJsonl(name, limit = 200) {
    const raw = readRaw(name);
    if (!raw) return [];
    const lines = raw.split("\n").filter(Boolean);
    const slice = limit > 0 ? lines.slice(-limit) : lines;
    const out = [];
    for (const line of slice) {
      try {
        out.push(JSON.parse(line));
      } catch (_) {
        /* 跳过坏行 */
      }
    }
    return out;
  }

  function rotate(name) {
    const target = fileOf(name);
    if (!fs.existsSync(target)) return;
    for (let i = BAK_KEEP - 1; i >= 0; i -= 1) {
      const from = i === 0 ? target : `${target}.bak${i}`;
      const to = `${target}.bak${i + 1}`;
      if (fs.existsSync(from)) {
        try {
          fs.renameSync(from, to);
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  return {
    dir,
    exists: (name) => fs.existsSync(fileOf(name)),
    readJson,
    writeJson,
    appendJsonl,
    readJsonl,
    rotate,
    size: (name) => {
      try {
        return fs.statSync(fileOf(name)).size;
      } catch (_) {
        return 0;
      }
    }
  };
}

export function ensureToken(dir) {
  const p = path.join(dir, "token.txt");
  try {
    const t = fs.readFileSync(p, "utf8").trim();
    if (t) return { token: t, created: false };
  } catch (_) {
    /* 不存在则生成 */
  }
  const token = "nova_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(p, token, "utf8");
  return { token, created: true };
}
