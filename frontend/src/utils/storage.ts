// 安全的 localStorage 封装：
// 在无痕模式、禁用第三方 Cookie、sandbox iframe（无 allow-same-origin）等场景下
// 直接访问 localStorage 会抛 SecurityError，这里降级为内存存储保证功能不崩溃。
const memory = new Map<string, string>();

let available = true;
try {
  const probeKey = '__storage_probe__';
  window.localStorage.setItem(probeKey, '1');
  window.localStorage.removeItem(probeKey);
} catch {
  available = false;
}

export function safeGet(key: string): string | null {
  if (!available) return memory.has(key) ? memory.get(key)! : null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.has(key) ? memory.get(key)! : null;
  }
}

export function safeSet(key: string, value: string): void {
  memory.set(key, value);
  if (!available) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 降级为内存存储 */
  }
}

export function safeRemove(key: string): void {
  memory.delete(key);
  if (!available) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const TESTDATA_ENABLED_KEY = 'draw_testdata_enabled';
export const TESTDATA_LIST_KEY = 'draw_testdata_list';
export const TESTDATA_ROUND_KEY = 'draw_test_round';
export const TESTDATA_WON_KEY = 'draw_test_won';

// 后台控制指令（AdminPage 写入 → HomePage 监听执行）
export const CONTROL_CMD_KEY = 'draw_control_cmd';
// 首页状态上报（HomePage 写入 → AdminPage 轮询展示）
export const CONTROL_STATE_KEY = 'draw_control_state';
