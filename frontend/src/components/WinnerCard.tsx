import React from 'react';

interface WinnerCardProps {
  avatar?: string;
  name: string;
  idNumber: string;
  /** 班级 */
  studentClass?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// 底层卡片图 card.png 原始尺寸（组件大小与卡片图一致：322 × 432）
export const CARD_WIDTH = 322;
export const CARD_HEIGHT = 432;

export const WinnerCard: React.FC<WinnerCardProps> = ({
  avatar = '/avatar.png',
  name,
  idNumber,
  studentClass = '',
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      onClick={onClick}
      className={[
        'relative shrink-0 select-none',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, ...style }}
    >
      {/* 底层卡片图 card.png */}
      <img
        src="/card.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* 头像层：300 × 328，圆角半径 10，位于底层卡片 (10, 10) */}
      <div
        className="absolute overflow-hidden bg-white/10"
        style={{ left: 10, top: 10, width: 300, height: 328, borderRadius: 10 }}
      >
        <img
          src={avatar}
          alt={name}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>

      {/* 学号底板图 di.png：151 × 34，位于底层卡片 (161, 305) */}
      <img
        src="/di.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute"
        style={{ left: 161, top: 305, width: 151, height: 34 }}
      />

      {/* 学号文字：位于底层卡片 (191, 310)，全站统一阿里妈妈数黑体 */}
      <div
        className="absolute whitespace-nowrap tabular-nums text-white"
        style={{
          left: 191,
          top: 310,
          fontSize: 16,
          lineHeight: '24px',
          fontFamily: '"AlimamaShuHeiTi", Arial, "Microsoft YaHei", sans-serif',
        }}
      >
        {idNumber}
      </div>

      {/* 姓名：位于底层卡片 (131, 346) */}
      <div
        className="font-ys-title absolute whitespace-nowrap text-white"
        style={{ left: 131, top: 346, fontSize: 30, lineHeight: '34px' }}
      >
        {name}
      </div>

      {/* 班级：位于底层卡片 (69, 389) */}
      {studentClass && (
        <div
          className="font-ys-title absolute whitespace-nowrap text-white/85"
          style={{ left: 69, top: 389, fontSize: 20, lineHeight: '24px' }}
        >
          {studentClass}
        </div>
      )}
    </div>
  );
};

export default WinnerCard;
