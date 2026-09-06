import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { StudentDTO } from '@/services/api';

const DEFAULT_AVATAR = '/avatar.png';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  // stuimg 预置头像文件名清单：页面打开时拉取一次，之后在本地按 姓名-学号 即时匹配
  const [avatarFiles, setAvatarFiles] = useState<string[]>([]);
  // 学生名册：页面打开时拉取一次，本地按 学号+姓名 双核验后显示班级
  const [students, setStudents] = useState<StudentDTO[]>([]);

  useEffect(() => {
    api
      .getAvatarManifest()
      .then((d) => setAvatarFiles(d.files))
      .catch(() => setAvatarFiles([]));
    api
      .getStudents()
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  // 按 姓名-学号 在清单里即时匹配，无需网络请求；未匹配显示默认头像
  const avatar = useMemo(() => {
    const n = name.trim();
    const id = idNumber.trim();
    if (!n || !id) return DEFAULT_AVATAR;
    const hit = avatarFiles.find((f) => f.startsWith(`${n}-${id}.`));
    return hit ? `/uploads/stuimg/${encodeURIComponent(hit)}` : DEFAULT_AVATAR;
  }, [avatarFiles, name, idNumber]);

  // 班级：学号命中学生库且姓名完全一致才显示，防止重名/错填
  const studentClass = useMemo(() => {
    const n = name.trim();
    const id = idNumber.trim();
    if (!n || !id) return '';
    const s = students.find((x) => x.id_number === id && x.name === n);
    return s ? s.class : '';
  }, [students, name, idNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    const trimmedName = name.trim();
    const trimmedId = idNumber.trim();
    if (!trimmedName || !trimmedId) {
      setStatus('error');
      setMessage('请填写姓名和学号');
      return;
    }

    setStatus('submitting');
    setMessage('');
    try {
      // 头像由管理员预置（按 姓名-学号 匹配），注册时只提交姓名和学号
      await api.createParticipant({ name: trimmedName, id_number: trimmedId });
      setStatus('success');
      setMessage('注册成功！请等待抽奖');
      // 重置表单，方便下一位同学注册
      setName('');
      setIdNumber('');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || '注册失败，请重试');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1F283B] to-[#3A6085] px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">抽奖信息录入</h1>

        {/* 头像：按 姓名-学号 实时匹配 stuimg 预置图，未匹配显示默认头像；下方显示匹配到的班级 */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src={avatar}
            alt="头像"
            className="h-28 w-28 rounded-full object-cover object-center ring-2 ring-gray-200"
          />
          <div className="mt-3 flex h-6 items-center text-base font-semibold text-gray-700">
            {studentClass}
          </div>
        </div>

        {/* 姓名 */}
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">姓名</span>
          <input
            type="text"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入姓名"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        {/* 学号 */}
        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">学号</span>
          <input
            type="text"
            value={idNumber}
            maxLength={30}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="请输入学号"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        {message && (
          <div
            className={`mb-4 rounded-lg px-3 py-2 text-center text-sm ${
              status === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-lg bg-[#3A6085] py-2.5 font-semibold text-white transition hover:bg-[#2f5070] disabled:opacity-60"
        >
          {status === 'submitting' ? '提交中…' : '确认注册'}
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
