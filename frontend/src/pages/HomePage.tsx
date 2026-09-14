import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageLayout from '@/layouts/PageLayout';
import WinnerCard, { CARD_WIDTH } from '@/components/WinnerCard';
import StudentMarqueeWall from '@/components/StudentMarqueeWall';
import { api, ParticipantDTO, WinnerDTO } from '@/services/api';

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
const MAX_ROUNDS = 3;

export const HomePage: React.FC = () => {
  // ---------- 跑马灯（TODO：按示例图重写）----------
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [wonIds, setWonIds] = useState<Set<string>>(new Set());

  // ---------- 抽奖状态 ----------
  const [currentRound, setCurrentRound] = useState(0);
  const [lotteryState, setLotteryState] = useState<'slow' | 'fast' | 'video'>('slow');
  const lotteryStateRef = useRef<'slow' | 'fast' | 'video'>('slow');
  const [winners, setWinners] = useState<Participant[]>([]);
  const [revealed, setRevealed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const revealedRef = useRef(false);
  const drawingRef = useRef(false);

  // ---------- 数据加载 ----------
  const loadData = useCallback(async () => {
    const [list, winnerList, round] = await Promise.all([
      api.getParticipants().catch(() => [] as ParticipantDTO[]),
      api.getWinners().catch(() => [] as WinnerDTO[]),
      api.getCurrentRound().catch(() => 0),
    ]);
    let all = list.map((p) => ({ avatar: p.avatar, name: p.name, idNumber: p.id_number }));
    // 测试数据开关：开启时将本地测试数据并入跑马灯（不写入数据库）
    if (localStorage.getItem('draw_testdata_enabled') === '1') {
      const saved = localStorage.getItem('draw_testdata_list');
      if (saved) {
        try {
          const testList = JSON.parse(saved) as { name: string; id_number: string; avatar: string }[];
          all = all.concat(
            testList.map((t) => ({ avatar: t.avatar || '/avatar.png', name: t.name, idNumber: t.id_number }))
          );
        } catch { /* ignore */ }
      }
    }
    setParticipants(all);
    setWonIds(new Set(winnerList.map((w) => w.id_number.trim())));
    if (lotteryStateRef.current === 'slow') setCurrentRound(round);
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 5000);
    // 后台切换测试数据开关时立即刷新
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'draw_testdata_enabled' || e.key === 'draw_testdata_list') {
        loadData();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
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
  }, []);

  const drawRound = useCallback(async () => { applyDraw(await performDraw()); }, [performDraw, applyDraw]);

  const goHome = useCallback(() => {
    setLotteryState('slow');
    revealedRef.current = false;
    setRevealed(false);
    setWinners([]);
  }, []);

  const handleResetDraw = useCallback(async () => {
    if (!window.confirm('确定清空全部中奖记录并重置轮次吗？此操作不可恢复。')) return;
    try { await api.clearWinners(); } catch (err) { console.warn('[HomePage] 清空中奖记录失败:', err); }
    drawingRef.current = false;
    setCurrentRound(0);
    goHome();
  }, [goHome]);

  // ---------- 键盘控制 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (lotteryState === 'slow') {
        if (currentRound >= MAX_ROUNDS) return;
        setLotteryState('fast');
      } else if (lotteryState === 'fast') {
        setLotteryState('video');
        void drawRound();
      } else if (lotteryState === 'video') {
        goHome();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lotteryState, currentRound, goHome, drawRound]);

  // 进入 video 时复位并播放
  useEffect(() => {
    if (lotteryState !== 'video') return;
    revealedRef.current = false;
    setRevealed(false);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const play = () => v.play().catch((err) => console.warn('[video] play blocked:', err));
    if (v.readyState >= 2) { play(); }
    else { v.addEventListener('canplay', play, { once: true }); return () => v.removeEventListener('canplay', play); }
  }, [lotteryState]);

  // ---------- 待中奖池（供跑马灯使用）----------
  const marqueePool = participants.filter((p) => !wonIds.has(p.idNumber.trim()));
  const testDataOn = localStorage.getItem('draw_testdata_enabled') === '1';

  return (
    <PageLayout hideTopBar={lotteryState === 'video'} onResetDraw={handleResetDraw}>
      {/* ====== 跑马灯区域 ====== */}
      <div className="h-full w-full overflow-hidden pt-[55px]">
        <StudentMarqueeWall students={marqueePool} fast={lotteryState === 'fast'} />
      </div>

      {/* ====== 测试数据提示 ====== */}
      {testDataOn && lotteryState !== 'video' && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
          <span className="rotate-[-12deg] text-[72px] font-black tracking-[12px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            测试中...不代表实际结果
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
