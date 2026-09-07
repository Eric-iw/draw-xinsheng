import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/layouts/PageLayout';
import ParticipantCard from '@/components/ParticipantCard';
import WinnerCard, { CARD_WIDTH } from '@/components/WinnerCard';
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

const ROW_ROTATION = 'rotate-[3deg]';

// 中奖揭晓布局：共 10 人，两行每行 5 张；第一张卡片位于页面 (74, 64)
const WINNER_COUNT = 10;
const WINNER_COLS = 5;
const WINNER_ORIGIN_X = 74;
const WINNER_ORIGIN_Y = 100;
const WINNER_GAP_X = 39; // 卡片水平间距
const WINNER_GAP_Y = 16; // 上下行间距
const WINNER_STAGGER_MS = 110; // 卡片逐个翻牌间隔（稍快）
const MAX_ROUNDS = 3; // 抽奖总轮次

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

export const HomePage: React.FC = () => {
  const columns = 10;
  const [participants, setParticipants] = useState<Participant[]>([]);
  // 已中奖学号集合：跑马灯池排除这些人，已中奖不允许再次中奖
  const [wonIds, setWonIds] = useState<Set<string>>(new Set());
  // 当前已完成的抽奖轮次（以后端 winners 表轮次号为准，清空后归零）
  const [currentRound, setCurrentRound] = useState(0);

  // 抽奖流程状态镜像：轮询回调里据此判断能否同步轮次
  const lotteryStateRef = useRef<'slow' | 'fast' | 'video'>('slow');

  // 从后端加载参与者 + 已中奖名单 + 当前轮次（各自容错，互不影响轮询）
  const loadData = useCallback(async () => {
    const [list, winnerList, round] = await Promise.all([
      api.getParticipants().catch((err) => {
        console.warn('[HomePage] 加载参与者失败:', err);
        return [] as ParticipantDTO[];
      }),
      api.getWinners().catch(() => [] as WinnerDTO[]),
      api.getCurrentRound().catch(() => 0),
    ]);
    setParticipants(
      list.map((p) => ({ avatar: p.avatar, name: p.name, idNumber: p.id_number }))
    );
    setWonIds(new Set(winnerList.map((w) => w.id_number.trim())));
    // 仅在首页（slow）同步后端轮次：抽奖进行中该请求可能发出于本轮写入之前，
    // 拿到旧轮次号会覆盖 applyDraw 设置的值，导致顶部轮次显示错乱
    if (lotteryStateRef.current === 'slow') {
      setCurrentRound(round);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 5000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  // 待中奖池：已录入且未中奖
  const pool = useMemo(
    () => participants.filter((p) => !wonIds.has(p.idNumber.trim())),
    [participants, wonIds]
  );
  const rows = useMemo(() => chunk(pool, columns), [pool]);

  // slow → fast（3s 自动）→ video（第 8 秒翻牌揭晓，视频继续播完定格）→ slow（空格）
  const [lotteryState, setLotteryState] = useState<'slow' | 'fast' | 'video'>('slow');
  useEffect(() => {
    lotteryStateRef.current = lotteryState;
  }, [lotteryState]);
  // 中奖者（共 10 人）：进入 video 阶段时抽出；revealed：视频播放到第 8 秒后才允许揭晓
  const [winners, setWinners] = useState<Participant[]>([]);
  const [revealed, setRevealed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fastTimerRef = useRef<number | null>(null);
  const revealedRef = useRef(false);
  const drawingRef = useRef(false); // 防止一次抽奖重复请求
  // 清场过渡：本轮卡片翻走后再进入下一轮
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  // 轮间切换提前请求的结果缓存：清场动画结束时立刻应用，不用等网络
  const pendingDrawRef = useRef<DrawPayload | null>(null);
  const exitDoneRef = useRef(false); // 清场动画是否已结束（供慢请求回来后补应用）

  // 视频播放到第 8 秒（媒体真实进度）触发一次揭晓，不用定时器猜测
  const REVEAL_SECOND = 8;
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime >= REVEAL_SECOND && !revealedRef.current) {
      revealedRef.current = true;
      setRevealed(true);
    }
  }, []);

  // 只发起抽奖请求并返回结果（不写状态），供轮间切换提前预取
  const performDraw = useCallback(async (): Promise<DrawPayload | null> => {
    if (drawingRef.current) return null;
    drawingRef.current = true;
    try {
      const result = await api.drawWinners(WINNER_COUNT);
      const drawn: Participant[] = result.winners.map((w) => ({
        avatar: w.avatar,
        name: w.name,
        idNumber: w.id_number,
        studentClass: w.class || '',
      }));
      return { drawn, roundNo: result.round_no };
    } catch (err) {
      console.warn('[HomePage] 抽奖失败:', err);
      return null;
    } finally {
      drawingRef.current = false;
    }
  }, []);

  // 把一轮抽奖结果写入页面状态（中奖卡片 / 轮次 / 已中奖池）
  const applyDraw = useCallback((payload: DrawPayload | null) => {
    const drawn = payload ? payload.drawn : [];
    setWinners(drawn);
    if (payload && payload.roundNo > 0) setCurrentRound(payload.roundNo);
    // 立即从待中奖池移除本轮中奖者（等下一次轮询也会同步）
    setWonIds((prev) => {
      const next = new Set(prev);
      drawn.forEach((d) => next.add(d.idNumber.trim()));
      return next;
    });
  }, []);

  const drawRound = useCallback(async () => {
    applyDraw(await performDraw());
  }, [performDraw, applyDraw]);

  // 回到首页（跑马灯）并复位所有展示状态
  const goHome = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    exitDoneRef.current = true;
    pendingDrawRef.current = null;
    setExiting(false);
    setLotteryState('slow');
    revealedRef.current = false;
    setRevealed(false);
    setWinners([]);
  }, []);

  // 顶部栏"清空抽奖记录"：清空后端中奖记录与轮次，本地立即复位
  const handleResetDraw = useCallback(async () => {
    if (!window.confirm('确定清空全部中奖记录并重置轮次吗？此操作不可恢复。')) return;
    try {
      await api.clearWinners();
    } catch (err) {
      console.warn('[HomePage] 清空中奖记录失败:', err);
    }
    drawingRef.current = false;
    setCurrentRound(0);
    setWonIds(new Set());
    goHome();
  }, [goHome]);

  // 空格键：slow → fast（共三轮，三轮后空格不再开启新一轮）；
  // video 已揭晓且未满三轮 → 清场动画后直接进入下一轮（不再重播视频）；第三轮结束 → slow 回首页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (lotteryState === 'slow') {
        if (currentRound >= MAX_ROUNDS) return; // 三轮已抽完，停留首页
        setLotteryState('fast');
      } else if (lotteryState === 'video') {
        if (!revealed || currentRound >= MAX_ROUNDS) {
          // 视频未播到揭晓（中途退出）或第三轮已揭晓 → 回首页
          goHome();
        } else if (winners.length > 0) {
          // 轮间切换：不进首页。立即定格视频并提前发起下一轮抽奖，
          // 清场动画一结束卡片立刻翻牌，不再等待网络往返
          if (exitTimerRef.current !== null) return; // 清场进行中，忽略重复按键
          videoRef.current?.pause();
          pendingDrawRef.current = null;
          exitDoneRef.current = false;
          setExiting(true);
          exitTimerRef.current = window.setTimeout(() => {
            exitTimerRef.current = null;
            exitDoneRef.current = true;
            setExiting(false);
            setWinners([]);
            revealedRef.current = false;
            setRevealed(true); // 后续轮次不播视频：门闩直接打开
            const pending = pendingDrawRef.current;
            if (pending !== null) applyDraw(pending);
            // pending 仍为 null 表示请求较慢，返回后由 exitDoneRef 检查补应用
          }, 500);
          void performDraw().then((p) => {
            pendingDrawRef.current = p;
            if (exitDoneRef.current) applyDraw(p); // 动画已结束则立即应用
          });
        }
      }
      // fast 时忽略空格，等 3s 自动
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lotteryState, currentRound, revealed, winners, performDraw, applyDraw, goHome]);

  // fast 结束后调后端抽奖接口，再进入 video 阶段
  useEffect(() => {
    if (lotteryState !== 'fast') return;
    fastTimerRef.current = window.setTimeout(() => {
      void drawRound().finally(() => setLotteryState('video'));
    }, 1500);
    return () => {
      if (fastTimerRef.current !== null) {
        window.clearTimeout(fastTimerRef.current);
        fastTimerRef.current = null;
      }
    };
  }, [lotteryState, drawRound]);

  // 进入 video 时复位揭晓门闩并自动播放
  useEffect(() => {
    if (lotteryState === 'video') {
      revealedRef.current = false;
      setRevealed(false);
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => { /* autoplay blocked */ });
      }
    }
  }, [lotteryState]);

  const animationStyle = useCallback((rowIdx: number): React.CSSProperties => {
    const baseSlow = rowIdx % 2 === 0 ? 32 : 40;
    if (lotteryState === 'fast') return { animationDuration: `${baseSlow / 30}s` };
    if (lotteryState === 'video') return { animationPlayState: 'paused', animationDuration: `${baseSlow}s` };
    return { animationDuration: `${baseSlow}s` };
  }, [lotteryState]);

  return (
    <PageLayout hideTopBar={lotteryState === 'video'} onResetDraw={handleResetDraw}>
      <div className="flex h-full w-full flex-col justify-start gap-10 px-0 pt-[80px]">
        {rows.map((row, rowIdx) => {
          const direction = rowIdx % 2 === 0 ? 'marquee-left' : 'marquee-right';
          const doubled = [...row, ...row];

          return (
            <div key={rowIdx} className="relative w-full">
              <div className={['w-max', ROW_ROTATION].join(' ')}>
                <div
                  className={['flex items-center gap-x-5 gap-y-3 w-max', direction].join(' ')}
                  style={animationStyle(rowIdx)}
                >
                  {doubled.map((p, i) => (
                    <ParticipantCard
                      key={i}
                      avatar={p.avatar}
                      name={p.name}
                      idNumber={p.idNumber}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 视频层：全覆盖，hideTopBar 负责顶栏隐藏；播完自然锁定最后一帧 */}
      {lotteryState === 'video' && (
        <video
          ref={videoRef}
          src="/video/draw.mp4"
          className="fixed inset-0 z-[100] h-full w-full object-cover"
          playsInline
          autoPlay
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {/* 轮次标题：视频第 8 秒随揭晓出现，显示"第 X 轮抽奖"；清场时随卡片一同消失 */}
      {lotteryState === 'video' && revealed && !exiting && winners.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-[20px] z-[120] flex items-center justify-center gap-[20px]">
          <img src="/xian.png" alt="" className="h-[20px] w-auto" />
          <div className="font-ys-title text-[36px] leading-[42px] tracking-[6px] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            第 {currentRound} 轮抽奖
          </div>
          <img src="/xian.png" alt="" className="h-[20px] w-auto -scale-x-100" />
        </div>
      )}

      {/* 中奖者揭晓层：视频第 8 秒渲染，10 张卡片两行（每行 5 张）逐个翻牌出现 */}
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
              className={exiting ? 'winner-flip-out' : 'winner-flip'}
              avatar={w.avatar}
              name={w.name}
              idNumber={w.idNumber}
              studentClass={w.studentClass}
              style={exiting ? undefined : { animationDelay: `${i * WINNER_STAGGER_MS}ms` }}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default HomePage;
