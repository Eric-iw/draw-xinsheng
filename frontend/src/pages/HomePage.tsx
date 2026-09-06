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

const ROW_ROTATION = 'rotate-[3deg]';

// 中奖揭晓布局：共 10 人，两行每行 5 张；第一张卡片位于页面 (74, 64)
const WINNER_COUNT = 10;
const WINNER_COLS = 5;
const WINNER_ORIGIN_X = 74;
const WINNER_ORIGIN_Y = 64;
const WINNER_GAP_X = 39; // 卡片水平间距
const WINNER_GAP_Y = 16; // 上下行间距
const WINNER_STAGGER_MS = 110; // 卡片逐个翻牌间隔（稍快）

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

  // 从后端加载参与者 + 已中奖名单（各自容错，互不影响轮询）
  const loadData = useCallback(async () => {
    const [list, winnerList] = await Promise.all([
      api.getParticipants().catch((err) => {
        console.warn('[HomePage] 加载参与者失败:', err);
        return [] as ParticipantDTO[];
      }),
      api.getWinners().catch(() => [] as WinnerDTO[]),
    ]);
    setParticipants(
      list.map((p) => ({ avatar: p.avatar, name: p.name, idNumber: p.id_number }))
    );
    setWonIds(new Set(winnerList.map((w) => w.id_number.trim())));
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 5000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  // 待中奖池：已注册且未中奖
  const pool = useMemo(
    () => participants.filter((p) => !wonIds.has(p.idNumber.trim())),
    [participants, wonIds]
  );
  const rows = useMemo(() => chunk(pool, columns), [pool]);

  // slow → fast（3s 自动）→ video（第 8 秒翻牌揭晓，视频继续播完定格）→ slow（空格）
  const [lotteryState, setLotteryState] = useState<'slow' | 'fast' | 'video'>('slow');
  // 中奖者（共 10 人）：进入 video 阶段时抽出；revealed：视频播放到第 8 秒后才允许揭晓
  const [winners, setWinners] = useState<Participant[]>([]);
  const [revealed, setRevealed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fastTimerRef = useRef<number | null>(null);
  const revealedRef = useRef(false);
  const drawingRef = useRef(false); // 防止一次抽奖重复请求

  // 视频播放到第 8 秒（媒体真实进度）触发一次揭晓，不用定时器猜测
  const REVEAL_SECOND = 8;
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime >= REVEAL_SECOND && !revealedRef.current) {
      revealedRef.current = true;
      setRevealed(true);
    }
  }, []);

  // 空格键：slow → fast；video 时（含已揭晓）→ slow 并重置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (lotteryState === 'slow') {
        setLotteryState('fast');
      } else if (lotteryState === 'video') {
        setLotteryState('slow');
        revealedRef.current = false;
        setRevealed(false);
        setWinners([]);
      }
      // fast 时忽略空格，等 3s 自动
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lotteryState]);

  // fast 结束后调后端抽奖接口（已中奖排除、拟定优先），再进入 video 阶段
  useEffect(() => {
    if (lotteryState !== 'fast') return;
    fastTimerRef.current = window.setTimeout(async () => {
      if (drawingRef.current) return;
      drawingRef.current = true;
      try {
        const result = await api.drawWinners(WINNER_COUNT);
        const drawn: Participant[] = result.winners.map((w) => ({
          avatar: w.avatar,
          name: w.name,
          idNumber: w.id_number,
          studentClass: w.class || '',
        }));
        setWinners(drawn);
        // 立即从待中奖池移除本轮中奖者（等下一次轮询也会同步）
        setWonIds((prev) => {
          const next = new Set(prev);
          drawn.forEach((d) => next.add(d.idNumber.trim()));
          return next;
        });
      } catch (err) {
        console.warn('[HomePage] 抽奖失败:', err);
        setWinners([]);
      } finally {
        drawingRef.current = false;
        setLotteryState('video');
      }
    }, 2000);
    return () => {
      if (fastTimerRef.current !== null) {
        window.clearTimeout(fastTimerRef.current);
        fastTimerRef.current = null;
      }
    };
  }, [lotteryState]);

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
    <PageLayout hideTopBar={lotteryState === 'video'}>
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
