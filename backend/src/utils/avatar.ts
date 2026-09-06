import fs from 'fs';
import path from 'path';

// 预置头像目录：backend/uploads/stuimg，由管理员放入，文件命名「姓名-学号.扩展名」
const STUIMG_DIR = path.resolve(__dirname, '../../uploads/stuimg');
const AVATAR_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// 按 姓名-学号 匹配预置头像；匹配到返回可访问 URL，未匹配返回 null
export function matchAvatar(name: string, idNumber: string): string | null {
  const n = String(name).trim();
  const id = String(idNumber).trim();
  for (const ext of AVATAR_EXTS) {
    const file = `${n}-${id}${ext}`;
    if (fs.existsSync(path.join(STUIMG_DIR, file))) {
      return `/uploads/stuimg/${file}`;
    }
  }
  return null;
}

// 注册用：未匹配到预置头像时回退默认头像
export function matchAvatarOrDefault(name: string, idNumber: string): string {
  return matchAvatar(name, idNumber) ?? '/avatar.png';
}

// 列出 stuimg 中全部预置头像文件名（供注册页一次性拉取后本地匹配，避免逐字查库）
export function listAvatarFiles(): string[] {
  try {
    return fs
      .readdirSync(STUIMG_DIR)
      .filter((f) => AVATAR_EXTS.includes(path.extname(f).toLowerCase()));
  } catch {
    return [];
  }
}
