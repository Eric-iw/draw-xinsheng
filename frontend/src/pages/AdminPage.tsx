import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  api,
  StudentDTO,
  ParticipantDTO,
  WinnerDTO,
  PresetDTO,
} from '@/services/api';

type TabKey = 'students' | 'participants' | 'winners' | 'preset';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'students', label: '学生库' },
  { key: 'participants', label: '已录入信息' },
  { key: 'winners', label: '已中奖名单' },
  { key: 'preset', label: '拟定中奖人' },
];

const inputCls =
  'rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const btnPrimary =
  'rounded-md bg-[#3A6085] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#2f5070] transition disabled:opacity-60';
const btnDanger =
  'rounded-md border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 transition';

function fmtTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('students');
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [winners, setWinners] = useState<WinnerDTO[]>([]);
  const [presets, setPresets] = useState<PresetDTO[]>([]);
  const [tip, setTip] = useState<{ ok: boolean; text: string } | null>(null);

  const showTip = (ok: boolean, text: string) => {
    setTip({ ok, text });
    window.setTimeout(() => setTip(null), 2600);
  };

  const loadStudents = useCallback(async () => {
    try {
      setStudents(await api.getStudents());
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  }, []);
  const loadParticipants = useCallback(async () => {
    try {
      setParticipants(await api.getParticipants());
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  }, []);
  const loadWinners = useCallback(async () => {
    try {
      setWinners(await api.getWinners());
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  }, []);
  const loadPresets = useCallback(async () => {
    try {
      setPresets(await api.getPreset());
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  }, []);

  // 切换标签时加载该页数据（跨表关联的页一并拉取）
  useEffect(() => {
    if (tab === 'students') {
      loadStudents();
      loadParticipants();
    } else if (tab === 'participants') {
      loadParticipants();
      loadStudents();
    } else if (tab === 'winners') {
      loadWinners();
      loadStudents();
    } else {
      loadPresets();
      loadParticipants();
      loadWinners();
    }
  }, [tab, loadStudents, loadParticipants, loadWinners, loadPresets]);

  const classById = React.useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => m.set(s.id_number.trim(), s.class || ''));
    return m;
  }, [students]);
  const winnerIds = React.useMemo(
    () => new Set(winners.map((w) => w.id_number.trim())),
    [winners]
  );

  // ---------- 学生库表单 ----------
  const [sName, setSName] = useState('');
  const [sId, setSId] = useState('');
  const [sClass, setSClass] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);

  // 学号单元格可能被 Excel 存为数字：安全整数直接转字符串，避免科学计数法
  const cellText = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    return String(v).trim();
  };

  // 解析 xlsx：首个工作表，表头含「姓名」「学号」「班级」，列序不限
  const importXlsx = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        showTip(false, 'Excel 中没有工作表');
        return;
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
      // 找表头行
      let headerIdx = -1;
      let colName = -1;
      let colId = -1;
      let colClass = -1;
      rows.forEach((row, i) => {
        const cells = (row as unknown[]).map((c) => cellText(c));
        const n = cells.findIndex((c) => c.includes('姓名'));
        const id = cells.findIndex((c) => c.includes('学号'));
        if (n >= 0 && id >= 0 && headerIdx < 0) {
          headerIdx = i;
          colName = n;
          colId = id;
          colClass = cells.findIndex((c) => c.includes('班级'));
        }
      });
      if (headerIdx < 0) {
        showTip(false, '未找到表头：请使用模板（表头须包含「姓名」「学号」）');
        return;
      }
      const list: { name: string; id_number: string; class: string }[] = [];
      const skipped: number[] = [];
      rows.slice(headerIdx + 1).forEach((row, i) => {
        const cells = row as unknown[];
        const name = cellText(cells[colName]);
        const id_number = cellText(cells[colId]);
        const className = colClass >= 0 ? cellText(cells[colClass]) : '';
        if (!name && !id_number) return; // 空行
        if (name && id_number) list.push({ name, id_number, class: className });
        else skipped.push(headerIdx + i + 2); // Excel 行号（1 起，含表头）
      });
      if (!list.length) {
        showTip(false, skipped.length ? `没有可导入的有效行（第 ${skipped.join('、')} 行缺少姓名或学号）` : '表格中没有数据行');
        return;
      }
      const r = await api.bulkCreateStudents(list);
      showTip(
        true,
        `导入完成：成功 ${r.affected} 条 / 共 ${r.total} 条（重复学号已跳过）` +
          (skipped.length ? `；第 ${skipped.join('、')} 行因缺少姓名或学号被跳过` : '')
      );
      loadStudents();
    } catch (e) {
      showTip(false, `Excel 解析失败：${(e as Error).message}`);
    }
  };

  // 下载导入模板（姓名/学号/班级）
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['姓名', '学号', '班级'],
      ['张三', '202350350001', '高三（1）班'],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学生名单');
    XLSX.writeFile(wb, '学生库导入模板.xlsx');
  };

  const addStudent = async () => {
    if (!sName.trim() || !sId.trim()) {
      showTip(false, '姓名和学号必填');
      return;
    }
    try {
      await api.createStudent({ name: sName.trim(), id_number: sId.trim(), class: sClass.trim() });
      setSName('');
      setSId('');
      setSClass('');
      showTip(true, '已添加到学生库');
      loadStudents();
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  };

  const importBulk = async () => {
    const list = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, id_number, className] = line.split(/[,，\t]/).map((x) => (x || '').trim());
        return { name, id_number, class: className || '' };
      })
      .filter((x) => x.name && x.id_number);
    if (!list.length) {
      showTip(false, '请按 姓名,学号,班级 每行一条输入');
      return;
    }
    try {
      const r = await api.bulkCreateStudents(list);
      setBulkText('');
      showTip(true, `导入完成：成功 ${r.affected} 条 / 共 ${r.total} 条（重复学号已跳过）`);
      loadStudents();
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  };

  // ---------- 拟定中奖人表单 ----------
  const [presetInput, setPresetInput] = useState('');
  const [candidateStudents, setCandidateStudents] = useState<StudentDTO[] | null>(null);

  const doAddPreset = async (id_number: string) => {
    try {
      await api.addPreset(id_number);
      setPresetInput('');
      setCandidateStudents(null);
      showTip(true, '已加入拟定中奖人');
      loadPresets();
    } catch (e) {
      showTip(false, (e as Error).message);
    }
  };

  const handleAddPreset = async () => {
    const q = presetInput.trim();
    if (!q) {
      showTip(false, '请输入学号或姓名');
      return;
    }

    // 1. 优先按姓名或学号精确匹配
    const exactMatches = students.filter(
      (s) => s.id_number.trim() === q || s.name.trim() === q
    );

    if (exactMatches.length === 1) {
      // 唯一匹配，直接添加
      await doAddPreset(exactMatches[0].id_number);
      return;
    }

    if (exactMatches.length > 1) {
      // 遇重名/多个匹配项，提示管理员手动审核选择
      setCandidateStudents(exactMatches);
      showTip(false, `找到 ${exactMatches.length} 位同名/同编号学生，请在下方手动审核选择`);
      return;
    }

    // 2. 尝试模糊匹配（包含该姓名或学号）
    const fuzzyMatches = students.filter(
      (s) => s.name.includes(q) || s.id_number.includes(q)
    );

    if (fuzzyMatches.length === 1) {
      await doAddPreset(fuzzyMatches[0].id_number);
    } else if (fuzzyMatches.length > 1) {
      setCandidateStudents(fuzzyMatches);
      showTip(false, `找到 ${fuzzyMatches.length} 位匹配学生，请在下方手动审核选择`);
    } else {
      showTip(false, '学生库中未找到该姓名或学号的学生');
    }
  };

  // 可拟定：已录入且未中奖的学生
  const eligibleParticipants = participants.filter(
    (p) => !winnerIds.has(p.id_number.trim())
  );

  return (
    // 全局 body 为 overflow:hidden（抽奖全屏页需要），后台页根容器自身承担滚动
    <div className="h-screen overflow-y-auto bg-gray-100 text-gray-900">
      <header className="bg-[#1F283B] px-8 py-4 text-white">
        <h1 className="text-xl font-bold">抽奖系统 · 后台管理</h1>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* 标签页 */}
        <div className="mb-5 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t-lg px-5 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-white text-[#1F283B] shadow-sm'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tip && (
          <div
            className={`mb-4 rounded-md px-4 py-2 text-sm ${
              tip.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {tip.text}
          </div>
        )}

        <div className="rounded-b-lg rounded-tr-lg bg-white p-6 shadow-sm">
          {/* ============ 学生库 ============ */}
          {tab === 'students' && (
            <div>
              <div className="mb-5 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">姓名</span>
                  <input className={inputCls} value={sName} onChange={(e) => setSName(e.target.value)} placeholder="姓名" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">学号</span>
                  <input className={inputCls} value={sId} onChange={(e) => setSId(e.target.value)} placeholder="学号" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">班级</span>
                  <input className={inputCls} value={sClass} onChange={(e) => setSClass(e.target.value)} placeholder="班级（选填）" />
                </label>
                <button className={btnPrimary} onClick={addStudent}>
                  添加学生
                </button>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importXlsx(f);
                    e.target.value = ''; // 允许重复选择同一文件
                  }}
                />
                <button className={btnPrimary} onClick={() => xlsxInputRef.current?.click()}>
                  导入 Excel（.xlsx）
                </button>
                <button
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
                  onClick={downloadTemplate}
                >
                  下载导入模板
                </button>
                <span className="text-xs text-gray-400">模板表头：姓名、学号、班级（列序不限，重复学号自动跳过）</span>
                <button
                  className={`${btnDanger} ml-auto`}
                  onClick={async () => {
                    if (!window.confirm('确定清空整个学生库？此操作不可恢复。')) return;
                    await api.clearStudents();
                    showTip(true, '学生库已清空');
                    loadStudents();
                  }}
                >
                  清空学生库
                </button>
              </div>

              <details className="mb-5 rounded-md border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-600">
                  文本批量导入（每行一条：姓名,学号,班级）
                </summary>
                <textarea
                  className="mt-3 h-32 w-full rounded-md border border-gray-300 p-2 text-sm font-mono outline-none focus:border-blue-500"
                  placeholder={'张三,202350350001,高三（1）班\n李四,202350350002,高三（1）班'}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                <button className={`${btnPrimary} mt-2`} onClick={importBulk}>
                  批量导入
                </button>
              </details>

              <StudentTable
                students={students}
                search={studentSearch}
                onSearchChange={setStudentSearch}
                registeredIds={new Set(participants.map((p) => p.id_number.trim()))}
                onDelete={async (id) => {
                  await api.deleteStudent(id);
                  showTip(true, '已删除');
                  loadStudents();
                }}
                onAddPreset={async (id_number) => {
                  await api.addPreset(id_number);
                  showTip(true, '已加入拟定中奖人');
                  loadPresets();
                }}
                onRegister={async (name, id_number) => {
                  await api.createParticipant({ name, id_number });
                  showTip(true, '已录入');
                  loadParticipants();
                }}
              />
            </div>
          )}

          {/* ============ 已录入信息 ============ */}
          {tab === 'participants' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    className={inputCls}
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="按姓名 / 学号 / 班级搜索已录入…"
                  />
                  <span className="text-sm text-gray-500">
                    {participantSearch
                      ? `匹配 ${
                          participants.filter((p) => {
                            const cls = classById.get(p.id_number.trim()) || '';
                            return (
                              p.name.includes(participantSearch) ||
                              p.id_number.includes(participantSearch) ||
                              cls.includes(participantSearch)
                            );
                          }).length
                        } 条 / 共 ${participants.length} 条`
                      : `共 ${participants.length} 人已录入`}
                  </span>
                </div>
                <button
                  className={btnDanger}
                  onClick={async () => {
                    if (!window.confirm('确定清空全部已录入信息？此操作不可恢复。')) return;
                    await api.clearParticipants();
                    showTip(true, '已清空全部录入信息');
                    loadParticipants();
                  }}
                >
                  清空已录入
                </button>
              </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 pr-4">头像</th>
                  <th className="py-2 pr-4">姓名</th>
                  <th className="py-2 pr-4">学号</th>
                  <th className="py-2 pr-4">班级</th>
                  <th className="py-2 pr-4">录入时间</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .filter((p) => {
                    if (!participantSearch) return true;
                    const cls = classById.get(p.id_number.trim()) || '';
                    return (
                      p.name.includes(participantSearch) ||
                      p.id_number.includes(participantSearch) ||
                      cls.includes(participantSearch)
                    );
                  })
                  .map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    </td>
                    <td className="py-2 pr-4 font-semibold">{p.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.id_number}</td>
                    <td className="py-2 pr-4">{classById.get(p.id_number.trim()) || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500">{fmtTime(p.created_at)}</td>
                    <td className="py-2">
                      <button
                        className={btnDanger}
                        onClick={async () => {
                          await api.deleteParticipant(p.id);
                          showTip(true, '已删除该录入信息');
                          loadParticipants();
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {participants.filter((p) => {
                  if (!participantSearch) return true;
                  const cls = classById.get(p.id_number.trim()) || '';
                  return (
                    p.name.includes(participantSearch) ||
                    p.id_number.includes(participantSearch) ||
                    cls.includes(participantSearch)
                  );
                }).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">{participants.length === 0 ? '暂无录入信息' : '无匹配结果'}</td></tr>
                )}
              </tbody>
            </table>
            </div>
          )}

          {/* ============ 已中奖名单 ============ */}
          {tab === 'winners' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">共 {winners.length} 人已中奖</span>
                <div className="flex gap-2">
                  <button
                    className={btnPrimary}
                    onClick={() => {
                      const rows = winners.map((w) => ({
                        轮次: `第 ${w.round_no} 轮`,
                        姓名: w.name,
                        学号: w.id_number,
                        班级: classById.get(w.id_number.trim()) || '',
                        中奖时间: fmtTime(w.created_at),
                      }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, '中奖名单');
                      XLSX.writeFile(wb, '中奖名单.xlsx');
                    }}
                  >
                    导出 Excel
                  </button>
                  <button
                    className={btnDanger}
                    onClick={async () => {
                      if (!window.confirm('确定清空所有中奖记录？清空后这些学生可再次中奖。')) return;
                      await api.clearWinners();
                      showTip(true, '中奖记录已清空');
                      loadWinners();
                    }}
                  >
                    清空中奖记录
                  </button>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 pr-4">轮次</th>
                    <th className="py-2 pr-4">头像</th>
                    <th className="py-2 pr-4">姓名</th>
                    <th className="py-2 pr-4">学号</th>
                    <th className="py-2 pr-4">班级</th>
                    <th className="py-2">中奖时间</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map((w) => (
                    <tr key={w.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-semibold text-[#3A6085]">第 {w.round_no} 轮</td>
                      <td className="py-2 pr-4">
                        <img src={w.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                      </td>
                      <td className="py-2 pr-4 font-semibold">{w.name}</td>
                      <td className="py-2 pr-4 tabular-nums">{w.id_number}</td>
                      <td className="py-2 pr-4">{classById.get(w.id_number.trim()) || '—'}</td>
                      <td className="py-2 text-gray-500">{fmtTime(w.created_at)}</td>
                    </tr>
                  ))}
                  {winners.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">暂无中奖记录</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ============ 拟定中奖人 ============ */}
          {tab === 'preset' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <select
                  className={inputCls}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) doAddPreset(e.target.value);
                  }}
                >
                  <option value="">从已录入学生中快速选择…</option>
                  {eligibleParticipants.map((p) => (
                    <option key={p.id} value={p.id_number}>
                      {p.name}（{p.id_number}）
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  value={presetInput}
                  onChange={(e) => {
                    setPresetInput(e.target.value);
                    if (candidateStudents) setCandidateStudents(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPreset();
                  }}
                  placeholder="输入学号或姓名搜索添加…"
                />
                <button className={btnPrimary} onClick={handleAddPreset}>
                  搜索添加
                </button>
                <button
                  className={btnDanger}
                  onClick={async () => {
                    if (!window.confirm('确定清空全部拟定？')) return;
                    await api.clearPreset();
                    showTip(true, '已清空拟定');
                    loadPresets();
                  }}
                >
                  清空全部拟定
                </button>
              </div>

              {/* 遇到重名/多匹配项时的管理员审核选择卡片 */}
              {candidateStudents && candidateStudents.length > 0 && (
                <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 p-4">
                  <div className="mb-2 text-sm font-bold text-amber-800">
                    检测到 {candidateStudents.length} 条匹配学生，请管理员审核确认拟定哪一位：
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {candidateStudents.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-2 shadow-sm"
                      >
                        <div>
                          <span className="font-semibold text-gray-900">{s.name}</span>
                          <span className="ml-2 text-xs tabular-nums text-gray-500">（学号: {s.id_number}）</span>
                          {s.class && <span className="ml-2 text-xs text-gray-400">[{s.class}]</span>}
                        </div>
                        <button
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          onClick={() => doAddPreset(s.id_number)}
                        >
                          选择此人
                        </button>
                      </div>
                    ))}
                    <button
                      className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() => setCandidateStudents(null)}
                    >
                      取消选择
                    </button>
                  </div>
                </div>
              )}

              <p className="mb-4 text-xs text-gray-400">
                拟定的学生将在下一轮抽奖中优先中奖（须已录入信息且未中过奖）；抽奖后自动清除已中奖的拟定。
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 pr-4">学号</th>
                    <th className="py-2 pr-4">姓名</th>
                    <th className="py-2 pr-4">班级</th>
                    <th className="py-2 pr-4">录入状态</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {presets.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 tabular-nums">{p.id_number}</td>
                      <td className="py-2 pr-4 font-semibold">
                        {p.participant_name || p.student_name || '—'}
                      </td>
                      <td className="py-2 pr-4">{p.class || '—'}</td>
                      <td className="py-2 pr-4">
                        {p.participant_id ? (
                          <span className="text-green-600">已录入</span>
                        ) : (
                          <span className="text-amber-600">未录入（暂不会中奖）</span>
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          className={btnDanger}
                          onClick={async () => {
                            await api.deletePreset(p.id);
                            showTip(true, '已移除');
                            loadPresets();
                          }}
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {presets.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-400">暂无拟定中奖人</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 学生库表格（带是否已录入标记）
const StudentTable: React.FC<{
  students: StudentDTO[];
  search: string;
  onSearchChange: (v: string) => void;
  registeredIds: Set<string>;
  onDelete: (id: number) => void;
  onAddPreset: (id_number: string) => Promise<void>;
  onRegister: (name: string, id_number: string) => Promise<void>;
}> = ({ students, search, onSearchChange, registeredIds, onDelete, onAddPreset, onRegister }) => {
  const filtered = students.filter(
    (s) => !search || s.name.includes(search) || s.id_number.includes(search) || (s.class && s.class.includes(search))
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          className={inputCls}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="按姓名 / 学号 / 班级搜索学生库…"
        />
        <span className="text-sm text-gray-400">
          {search ? `匹配 ${filtered.length} 条 / 共 ${students.length} 条` : `共 ${students.length} 条`}
        </span>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2 pr-4">头像</th>
            <th className="py-2 pr-4">学号</th>
            <th className="py-2 pr-4">姓名</th>
            <th className="py-2 pr-4">班级</th>
            <th className="py-2 pr-4">注册状态</th>
            <th className="py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="py-2 pr-4">
                {s.avatar ? (
                  <img
                    src={s.avatar}
                    alt={s.name}
                    title="stuimg 中已匹配到该学生的头像"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span
                    title="uploads/stuimg 中没有该学生的图片（命名应为 姓名-学号.扩展名）"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500"
                  >
                    无图
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 tabular-nums">{s.id_number}</td>
              <td className="py-2 pr-4 font-semibold">{s.name}</td>
              <td className="py-2 pr-4">{s.class || '—'}</td>
              <td className="py-2 pr-4">
                {registeredIds.has(s.id_number.trim()) ? (
                  <span className="text-green-600">已录入</span>
                ) : (
                  <span className="text-gray-400">未录入</span>
                )}
              </td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  {!registeredIds.has(s.id_number.trim()) && (
                    <button
                      className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 transition"
                      onClick={() => onRegister(s.name, s.id_number)}
                    >
                      录入
                    </button>
                  )}
                  <button
                    className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 transition"
                    onClick={() => onAddPreset(s.id_number)}
                  >
                    拟定
                  </button>
                  <button className={btnDanger} onClick={() => onDelete(s.id)}>
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-center text-gray-400">{students.length === 0 ? '学生库为空，请先添加学生' : '无匹配结果'}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPage;
