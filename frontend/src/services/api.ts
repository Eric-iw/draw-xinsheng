// 统一响应结构
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg?: string;
}

// 参与者
export interface ParticipantDTO {
  id: number;
  name: string;
  id_number: string;
  avatar: string;
  created_at: string;
}

// 中奖记录
export interface WinnerDTO {
  id: number;
  participant_id: number;
  name: string;
  id_number: string;
  avatar: string;
  round_no: number;
  created_at: string;
}

// 学生库（注册白名单）
export interface StudentDTO {
  id: number;
  name: string;
  id_number: string;
  class: string;
  created_at: string;
  // 按 姓名-学号 匹配 uploads/stuimg 的预置头像；null 表示未上传对应图片
  avatar: string | null;
}

// 拟定中奖人列表项
export interface PresetDTO {
  id: number;
  id_number: string;
  participant_id: number | null;
  participant_name: string | null;
  avatar: string | null;
  student_name: string | null;
  class: string | null;
  created_at: string;
}

// 一轮抽奖结果
export interface DrawResultDTO {
  round_no: number;
  winners: {
    participant_id: number;
    name: string;
    id_number: string;
    avatar: string;
    round_no: number;
    class: string;
  }[];
}

// 走相对路径 /api/*，开发时由 Vite proxy 转发到后端 http://localhost:3000
// 这样同一局域网内手机扫码访问也能正常工作（请求走服务器端代理）
const API_PREFIX = '';

// 网络/服务异常统一提示：不向前端暴露接口路径、状态码等技术信息
const SERVICE_ERROR_MSG = '服务未开启，请稍后再试';

// 4xx 业务校验失败（如姓名学号不匹配）时提取后端中文提示；其余情况统一提示服务异常
function pickBizMsg(status: number, body: ApiResponse<unknown> | null): string {
  if (status >= 400 && status < 500 && body && typeof body.msg === 'string' && body.msg.trim()) {
    return body.msg.trim();
  }
  return '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new Error(SERVICE_ERROR_MSG);
  }
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error(SERVICE_ERROR_MSG);
  }
  if (!res.ok || body.code !== 0) {
    throw new Error(pickBizMsg(res.status, body) || SERVICE_ERROR_MSG);
  }
  return body.data;
}

export const api = {
  getParticipants: () => request<ParticipantDTO[]>('/api/participants'),
  // 头像由管理员预置在 uploads/stuimg（命名 姓名-学号），注册时只提交姓名和学号
  createParticipant: (data: { name: string; id_number: string }) =>
    request<ParticipantDTO>('/api/participants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bulkCreateParticipants: (list: { name: string; id_number: string; avatar?: string }[]) =>
    request<{ affected: number }>('/api/participants/bulk', {
      method: 'POST',
      body: JSON.stringify(list),
    }),

  getWinners: () => request<WinnerDTO[]>('/api/winners'),
  recordWinner: (data: Omit<WinnerDTO, 'id' | 'round_no' | 'created_at'>) =>
    request<WinnerDTO>('/api/winners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCurrentRound: () => request<number>('/api/winners/current-round'),
  // 执行一轮抽奖（后端排除已中奖、优先拟定），返回本轮中奖名单
  drawWinners: (count = 10) =>
    request<DrawResultDTO>('/api/winners/draw', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),
  clearWinners: () => request<{ msg?: string }>('/api/winners', { method: 'DELETE' }),

  deleteParticipant: (id: number) =>
    request<boolean>(`/api/participants/${id}`, { method: 'DELETE' }),

  // 学生库（注册白名单）
  getStudents: () => request<StudentDTO[]>('/api/students'),
  // stuimg 预置头像文件名清单：注册页拉取一次后在本地按 姓名-学号 即时匹配
  getAvatarManifest: () =>
    request<{ files: string[] }>('/api/students/avatar-manifest'),
  createStudent: (data: { name: string; id_number: string; class?: string }) =>
    request<StudentDTO>('/api/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bulkCreateStudents: (list: { name: string; id_number: string; class?: string }[]) =>
    request<{ affected: number; total: number }>('/api/students/bulk', {
      method: 'POST',
      body: JSON.stringify(list),
    }),
  deleteStudent: (id: number) =>
    request<boolean>(`/api/students/${id}`, { method: 'DELETE' }),

  // 拟定中奖人
  getPreset: () => request<PresetDTO[]>('/api/preset'),
  addPreset: (id_number: string) =>
    request<{ id_number: string }>('/api/preset', {
      method: 'POST',
      body: JSON.stringify({ id_number }),
    }),
  deletePreset: (id: number) =>
    request<boolean>(`/api/preset/${id}`, { method: 'DELETE' }),
  clearPreset: () => request<{ msg?: string }>('/api/preset', { method: 'DELETE' }),
};
