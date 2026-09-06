import React from 'react';

interface ParticipantCardProps {
  avatar?: string;
  name: string;
  idNumber: string;
  onClick?: () => void;
  className?: string;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  avatar = '/avatar.png',
  name,
  idNumber,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center gap-2',
        'transition-transform duration-300',
        onClick ? 'cursor-pointer hover:scale-[1.03]' : '',
        className,
      ].join(' ')}
    >
      {/* 头像 */}
      <div className="relative h-[130px] w-[130px] overflow-hidden rounded-full bg-white shadow-[0_6px_20px_rgba(146,125,204,0.2)] flex items-center justify-center">
        <img
          src={avatar}
          alt={name}
          className="h-full w-full object-cover object-center"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className =
              'absolute inset-0 flex items-center justify-center text-4xl text-white/90 bg-gradient-to-br from-purple to-pink';
            fallback.textContent = name.charAt(0);
            target.parentNode?.appendChild(fallback);
          }}
        />
      </div>

      {/* 文字组 */}
      <div className="flex flex-col items-center gap-1 font-ys-title">
        {/* 名字 */}
        <div className="text-center leading-none">
          <div className="text-[26px] font-bold tracking-[2px] text-white">
            {name}
          </div>
        </div>
        {/* 编号 */}
        <div className="text-center leading-none">
          <div className="text-[19px] font-semibold tracking-[3px] text-white/80 tabular-nums">
            {idNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantCard;
