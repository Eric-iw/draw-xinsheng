import React from 'react';
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
const MARQUEE_DURATION = 40; // 慢速滚动时长（秒）
const FAST_DURATION = 8;     // 快速滚动时长（秒）
const ROW_GAP = 20;          // 行间距
const CARD_GAP = 24;         // 卡片外部间距
const ROW_ROTATION = 1.5;   // 每行整体倾斜角度

/** 把学生均匀分配到 ROW_COUNT 行，每人只出现一次 */
function distributeStudents(students: Student[], rowCount: number): Student[][] {
  const rows: Student[][] = Array.from({ length: rowCount }, () => []);
  students.forEach((s, i) => {
    rows[i % rowCount].push(s);
  });
  return rows;
}

export const StudentMarqueeWall: React.FC<StudentMarqueeWallProps> = ({ students, fast = false }) => {
  const rows = distributeStudents(students, ROW_COUNT);
  const duration = fast ? FAST_DURATION : MARQUEE_DURATION;

  return (
    <div
      className="flex w-full flex-col overflow-hidden pt-[30px] pb-[40px]"
      style={{ gap: `${ROW_GAP}px` }}
    >
      {rows.map((row, rowIdx) => {
        const direction = rowIdx % 2 === 0 ? 'marquee-left' : 'marquee-right';
        return (
          <div
            key={rowIdx}
            className="w-full overflow-hidden"
            style={{ transform: `rotate(${ROW_ROTATION}deg)` }}
          >
            <div
              className={`flex w-max flex-shrink-0 ${direction}`}
              style={{ animationDuration: `${duration}s`, willChange: 'transform' }}
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
      })}
    </div>
  );
};

export default StudentMarqueeWall;
