export interface Participant {
  id: number;
  name: string;
  id_number: string;
  avatar: string;
  openid?: string | null;
  created_at: Date;
}

export interface Winner {
  id: number;
  participant_id: number;
  name: string;
  id_number: string;
  avatar: string;
  round_no: number;
  created_at: Date;
}

// 学生库（录入白名单）
export interface Student {
  id: number;
  name: string;
  id_number: string;
  class: string;
  created_at: Date;
}

// 拟定中奖人
export interface PresetWinner {
  id: number;
  id_number: string;
  created_at: Date;
}

// 拟定中奖人列表项（关联参与者/学生库后的展示结构）
export interface PresetView {
  id: number;
  id_number: string;
  participant_id: number | null;
  participant_name: string | null;
  avatar: string | null;
  student_name: string | null;
  class: string | null;
  created_at: Date;
}

// 抽奖结果项（draw 接口返回，附带班级）
export interface DrawResult {
  participant_id: number;
  name: string;
  id_number: string;
  avatar: string;
  round_no: number;
  class: string;
}
