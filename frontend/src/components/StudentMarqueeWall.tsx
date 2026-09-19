import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import ParticipantCard from '@/components/ParticipantCard';

interface Student {
  avatar: string;
  name: string;
  idNumber: string;
}

interface StudentMarqueeWallProps {
  students: Student[];
  fast?: boolean;
}

const ROW_COUNT = 5;
const MARQUEE_DURATION = 150; // 慢速（秒）
const FAST_DURATION = 8;      // 快速（秒）
const ROW_GAP = 20;
const CARD_GAP = 24;
const ROW_ROTATION = 1.5;

/** 把学生均匀分配到 ROW_COUNT 行 */
function distributeStudents(students: Student[], rowCount: number): Student[][] {
  const rows: Student[][] = Array.from({ length: rowCount }, () => []);
  students.forEach((s, i) => {
    rows[i % rowCount].push(s);
  });
  return rows;
}

/** 单行跑马灯，速度切换时用 animation-delay 负值保持位置连续 */
const MarqueeRow: React.FC<{
  row: Student[];
  direction: 'left' | 'right';
  duration: number;
}> = ({ row, direction, duration }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(performance.now());   // 当前动画周期开始时间
  const durRef = useRef(duration);              // 当前动画时长

  // duration 变化时：计算旧动画已走比例 → 用负 delay 跳到相同比例
  const applyDuration = useCallback((newDur: number) => {
    const now = performance.now();
    const elapsed = (now - startRef.current) / 1000; // 秒
    const oldDur = durRef.current;
    const progress = (elapsed % oldDur) / oldDur;    // 0~1
    const newDelay = -progress * newDur;              // 负 delay = 跳到对应位置
    startRef.current = now + newDelay * 1000;         // 修正起始时间基准
    durRef.current = newDur;
    return { duration: `${newDur}s`, animationDelay: `${newDelay}s` };
  }, []);

  // 首次渲染和 duration 变化时更新 CSS
  useEffect(() => {
    if (!trackRef.current) return;
    const style = applyDuration(duration);
    trackRef.current.style.animationDuration = style.duration;
    trackRef.current.style.animationDelay = style.animationDelay;
  }, [duration, applyDuration]);

  const animName = direction === 'left' ? 'marqueeLeft' : 'marqueeRight';

  return (
    <div
      className="w-full overflow-hidden"
      style={{ transform: `rotate(${ROW_ROTATION}deg)` }}
    >
      <div
        ref={trackRef}
        className="flex w-max flex-shrink-0"
        style={{
          animation: `${animName} ${duration}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {[0, 1].map((copyIdx) => (
          <div
            key={copyIdx}
            className="flex flex-shrink-0 items-start"
            style={{ gap: `${CARD_GAP}px`, marginRight: `${CARD_GAP}px` }}
          >
            {row.map((s, i) => (
              <div key={`${copyIdx}-${i}`} className="flex-shrink-0">
                <ParticipantCard avatar={s.avatar} name={s.name} idNumber={s.idNumber} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const StudentMarqueeWall: React.FC<StudentMarqueeWallProps> = ({ students, fast = false }) => {
  const rows = useMemo(() => distributeStudents(students, ROW_COUNT), [students]);
  const duration = fast ? FAST_DURATION : MARQUEE_DURATION;

  return (
    <div
      className="flex w-full flex-col overflow-hidden pt-[30px] pb-[40px]"
      style={{ gap: `${ROW_GAP}px` }}
    >
      {rows.map((row, rowIdx) => (
        <MarqueeRow
          key={rowIdx}
          row={row}
          direction={rowIdx % 2 === 0 ? 'left' : 'right'}
          duration={duration}
        />
      ))}
    </div>
  );
};

export default StudentMarqueeWall;