import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageLayout from '@/layouts/PageLayout';
import WinnerCard, { CARD_WIDTH } from '@/components/WinnerCard';
import StudentMarqueeWall from '@/components/StudentMarqueeWall';
import { api, ParticipantDTO, WinnerDTO } from '@/services/api';
import {
  safeGet,
  safeSet,
  safeRemove,
  TESTDATA_ENABLED_KEY,
  TESTDATA_LIST_KEY,
  TESTDATA_ROUND_KEY,
  TESTDATA_WON_KEY,
} from '@/utils/storage';
import { generateTestStudents } from '@/utils/testData';

interface Participant {
  avatar: string;
  name: string;
  idNumber: string;
  studentClass?: string;
}

interface DrawPayload {
  drawn: Participant[];
  roundNo: number;
}

// 中奖揭晓布局
const WINNER_COUNT = 10;
const WINNER_COLS = 5;
const WINNER_ORIGIN_X = 74;
const WINNER_ORIGIN_Y = 100;
const WINNER_GAP_X = 39;
const WINNER_GAP_Y = 16;
const WINNER_STAGGER_MS = 110;

export const HomePage: React.FC = () => {
  // ---------- 跑马灯 ----------
  const [participants, setParticipants] = useState<Participant[]>([]);
  const participantsRef = useRef<Participant[]>([]);
  participantsRef.current = participants;
  const [wonIds, setWonIds] = useState<Set<string>>(new Set());

  // ---------- 抽奖状态 ----------
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(3); // 从后端配置读取，默认 3
  // 测试模式：支持 ?test=1 快捷开启（兼容 Chrome 下 sandbox / 跨源 localStorage 问题）
  const [testDataOn, setTestDataOn] = useState<boolean>(() => {
    if (new URLSearchParams(window.location.search).get('test') === '1') return true;
    return safeGet(TESTDATA_ENABLED_KEY) === '1';
  });
  const testDataOnRef = useRef(testDataOn);
  testDataOnRef.current = testDataOn;
  // 测试模式本地抽奖状态（轮次放 ref；已中奖学号同时放 state 驱动跑马灯重渲染）
  const testRoundRef = useRef(0);
  const [testWonIds, setTestWonIds] = useState<Set<string>>(new Set());
  const testWonIdsRef = useRef<Set<string>>(new Set());

  const [lotteryState, setLotteryState] = useState<'slow' | 'fast' | 'video'>('slow');
  const lotteryStateRef = useRef<'slow' | 'fast' | 'video'>('slow');
  const [winners, setWinners] = useState<Participant[]>([]);
  const [revealed, setRevealed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const revealedRef = useRef(false);
  const videoEndedRef = useRef(false); // 视频是否播放完毕（完毕后第三次空格才生效）
  const drawingRef = useRef(false);

  // 读取本地测试抽奖状态
  const readTestProgress = useCallback(() => {
    const r = Number(safeGet(TESTDATA_ROUND_KEY));
    const round = Number.isFinite(r) && r >= 0 ? r : 0;
    let won = new Set<string>();
    try {
      const arr = JSON.parse(safeGet(TESTDATA_WON_KEY) || '[]') as string[];
      if (Array.isArray(arr)) won = new Set(arr);
    } catch { /* ignore */ }
    testRoundRef.current = round;
    // 内容未变化时不更新 state，避免轮询触发跑马灯重渲染
    const prev = testWonIdsRef.current;
    const same = prev.size === won.size && Array.from(won).every((id) => prev.has(id));
    if (!same) {
      testWonIdsRef.current = won;
      setTestWonIds(won);
    }
    return { round, won };
  }, []);

  // ---------- 数据加载 ----------
  const loadData = useCallback(async () => {
    // 支持 URL 参数 ?test=1 / ?test=0 即时切换
    const param = new URLSearchParams(window.location.search).get('test');
    if (param === '1') safeSet(TESTDATA_ENABLED_KEY, '1');
    if (param === '0') safeSet(TESTDATA_ENABLED_KEY, '0');
    const testOn = safeGet(TESTDATA_ENABLED_KEY) === '1';
    setTestDataOn(testOn);

    if (testOn) {
      // 测试模式：不请求已录入/中奖/轮次接口，全部使用本地数据
      const config = await api.getConfig().catch(() => ({ maxRounds: 3 }));
      const mr = config.maxRounds || 3;
      setMaxRounds(mr);

      let saved = safeGet(TESTDATA_LIST_KEY);
      if (!saved) {
        // 本地没有测试数据时自动生成，保证 Chrome 等环境下开关一开就有人
        const list = generateTestStudents(100);
        safeSet(TESTDATA_LIST_KEY, JSON.stringify(list));
        saved = JSON.stringify(list);
      }
      const testList: Participant[] = [];
      try {
        const parsed = JSON.parse(saved) as { name: string; id_number: string; avatar: string; class?: string }[];
        parsed.forEach((t) =>
          testList.push({
            avatar: t.avatar || '/avatar.png',
            name: t.name,
            idNumber: t.id_number,
            studentClass: t.class || '',
          })
        );
      } catch { /* ignore */ }
      setParticipants(testList);

      const { round } = readTestProgress();
      // 上次测试已完成全部轮次且当前在首页（非抽奖进行中），重置以便重新开始
      if (round >= mr && lotteryStateRef.current === 'slow') {
        testRoundRef.current = 0;
        testWonIdsRef.current = new Set();
        setTestWonIds(new Set());
        safeRemove(TESTDATA_ROUND_KEY);
        safeRemove(TESTDATA_WON_KEY);
        setCurrentRound(0);
      } else if (lotteryStateRef.current === 'slow') {
        setCurrentRound(round);
      }
      return;
    }

    // 正式模式：请求后端真实数据
    const [list, winnerList, round, config] = await Promise.all([
      api.getParticipants().catch(() => [] as ParticipantDTO[]),
      api.getWinners().catch(() => [] as WinnerDTO[]),
      api.getCurrentRound().catch(() => 0),
      api.getConfig().catch(() => ({ maxRounds: 3 })),
    ]);
    setMaxRounds(config.maxRounds || 3);
    setParticipants(
      list.map((p) => ({ avatar: p.avatar, name: p.name, idNumber: p.id_number }))
    );
    setWonIds(new Set(winnerList.map((w) => w.id_number.trim())));
    if (lotteryStateRef.current === 'slow') setCurrentRound(round);
  }, [readTestProgress]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 5000);
    // 后台切换测试数据开关时立即刷新（跨标签页 storage 事件 + 同标签页自定义事件）
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'draw_testdata_enabled' || e.key === 'draw_testdata_list') {
        loadData();
      }
    };
    const onTestDataChange = () => loadData();
    window.addEventListener('storage', onStorage);
    window.addEventListener('draw_testdata_changed', onTestDataChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('draw_testdata_changed', onTestDataChange);
    };
  }, [loadData]);

  useEffect(() => { lotteryStateRef.current = lotteryState; }, [lotteryState]);

  // ---------- 抽奖逻辑 ----------
  const REVEAL_SECOND = 8;
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime >= REVEAL_SECOND && !revealedRef.current) {
      revealedRef.current = true;
      setRevealed(true);
    }
  }, []);

  const performDraw = useCallback(async (): Promise<DrawPayload | null> => {
    if (drawingRef.current) return null;
    drawingRef.current = true;
    try {
      // ===== 测试模式：纯本地随机抽奖，不请求后端、不写数据库 =====
      if (testDataOnRef.current) {
        const pool = participantsRef.current.filter(
          (p) => !testWonIdsRef.current.has(p.idNumber.trim())
        );
        // Fisher-Yates 洗牌后取前 WINNER_COUNT 个
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const drawn = pool.slice(0, WINNER_COUNT);
        return { drawn, roundNo: testRoundRef.current + 1 };
      }

      // ===== 正式模式：调用后端抽奖接口 =====
      const result = await api.drawWinners(WINNER_COUNT);
      return {
        drawn: result.winners.map((w) => ({ avatar: w.avatar, name: w.name, idNumber: w.id_number, studentClass: w.class || '' })),
        roundNo: result.round_no,
      };
    } catch (err) {
      console.warn('[HomePage] 抽奖失败:', err);
      return null;
    } finally { drawingRef.current = false; }
  }, []);

  const applyDraw = useCallback((payload: DrawPayload | null) => {
    const drawn = payload ? payload.drawn : [];
    setWinners(drawn);
    if (payload && payload.roundNo > 0) setCurrentRound(payload.roundNo);
    // 测试模式：把本轮中奖者和轮次写入本地，跑马灯下一轮自动排除
    if (testDataOnRef.current && payload) {
      const nextWon = new Set(testWonIdsRef.current);
      drawn.forEach((d) => nextWon.add(d.idNumber.trim()));
      testWonIdsRef.current = nextWon;
      setTestWonIds(nextWon);
      testRoundRef.current = payload.roundNo;
      safeSet(TESTDATA_ROUND_KEY, String(payload.roundNo));
      safeSet(TESTDATA_WON_KEY, JSON.stringify(Array.from(nextWon)));
    }
  }, []);

  const drawRound = useCallback(async () => { applyDraw(await performDraw()); }, [performDraw, applyDraw]);

  const goHome = useCallback(() => {
    setLotteryState('slow');
    revealedRef.current = false;
    videoEndedRef.current = false;
    setRevealed(false);
    setWinners([]);
  }, []);

  const handleResetDraw = useCallback(async () => {
    if (!window.confirm('确定清空全部中奖记录并重置轮次吗？此操作不可恢复。')) return;
    drawingRef.current = false;
    if (testDataOnRef.current) {
      // 测试模式：只清本地状态
      testRoundRef.current = 0;
      testWonIdsRef.current = new Set();
      setTestWonIds(new Set());
      safeRemove(TESTDATA_ROUND_KEY);
      safeRemove(TESTDATA_WON_KEY);
    } else {
      try { await api.clearWinners(); } catch (err) { console.warn('[HomePage] 清空中奖记录失败:', err); }
    }
    setCurrentRound(0);
    goHome();
  }, [goHome]);

  // ---------- 键盘控制 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (lotteryState === 'slow') {
        if (currentRound >= maxRounds) return;
        setLotteryState('fast');
      } else if (lotteryState === 'fast') {
        setLotteryState('video');
        void drawRound();
      } else if (lotteryState === 'video') {
        // 视频播放完毕后才允许退出
        if (!videoEndedRef.current) return;
        goHome();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lotteryState, currentRound, maxRounds, goHome, drawRound]);

  // 进入 video 时复位并播放
  useEffect(() => {
    if (lotteryState !== 'video') return;
    revealedRef.current = false;
    videoEndedRef.current = false;
    setRevealed(false);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const play = () => v.play().catch((err) => console.warn('[video] play blocked:', err));
    if (v.readyState >= 2) { play(); }
    else { v.addEventListener('canplay', play, { once: true }); return () => v.removeEventListener('canplay', play); }
  }, [lotteryState]);

  // ---------- 待中奖池（供跑马灯使用）----------
  // 待中奖池：测试模式排除本地中奖者，正式模式排除后端中奖记录
  const excludedWonIds = testDataOn ? testWonIds : wonIds;
  const marqueePool = participants.filter((p) => !excludedWonIds.has(p.idNumber.trim()));

  return (
    <PageLayout hideTopBar={lotteryState === 'video'} onResetDraw={handleResetDraw}>
      {/* ====== 跑马灯区域 ====== */}
      <div className="h-full w-full overflow-hidden pt-[55px]">
        <StudentMarqueeWall students={marqueePool} fast={lotteryState === 'fast'} />
      </div>

      {/* ====== 测试数据提示（测试模式开启时始终显示在最顶层） ====== */}
      {testDataOn && (
        <div className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center">
          <span className="rotate-[-12deg] text-[72px] font-black tracking-[12px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            测试中...不代表实际结果（数据为模拟数据）
          </span>
        </div>
      )}

      {/* ====== 视频层 ====== */}
      <video
        ref={videoRef}
        src="/video/draw.mp4"
        className={`fixed inset-0 h-full w-full object-cover transition-none ${
          lotteryState === 'video' ? 'z-[100] opacity-100' : '-z-[1] opacity-0 pointer-events-none'
        }`}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { videoEndedRef.current = true; }}
      />

      {/* ====== 轮次标题 ====== */}
      {lotteryState === 'video' && revealed && winners.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-[20px] z-[120] flex items-center justify-center gap-[20px]">
          <img src="/xian.png" alt="" className="h-[20px] w-auto" />
          <div className="font-ys-title text-[36px] leading-[42px] tracking-[6px] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            第 {currentRound} 轮抽奖
          </div>
          <img src="/xian.png" alt="" className="h-[20px] w-auto -scale-x-100" />
        </div>
      )}

      {/* ====== 中奖者揭晓层 ====== */}
      {lotteryState === 'video' && revealed && winners.length > 0 && (
        <div
          className="perspective-1200 pointer-events-none fixed z-[110] flex flex-wrap content-start"
          style={{
            left: WINNER_ORIGIN_X,
            top: WINNER_ORIGIN_Y,
            width: WINNER_COLS * CARD_WIDTH + (WINNER_COLS - 1) * WINNER_GAP_X,
            columnGap: WINNER_GAP_X,
            rowGap: WINNER_GAP_Y,
          }}
        >
          {winners.map((w, i) => (
            <WinnerCard
              key={`${w.idNumber}-${w.name}`}
              className="winner-flip"
              avatar={w.avatar}
              name={w.name}
              idNumber={w.idNumber}
              studentClass={w.studentClass}
              style={{ animationDelay: `${i * WINNER_STAGGER_MS}ms` }}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default HomePage;
