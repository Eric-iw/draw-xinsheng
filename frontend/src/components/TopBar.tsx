import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/**
 * 单个字符的上下翻页动画
 * - 始终渲染两层：top 是当前显示字符，bottom 是待翻入的新字符（默认空）
 * - 两层都占据相同的盒子，bottom 用 translateY(100%) 藏在下方被 overflow 裁掉
 * - 动画时 top 向上滑出，bottom 同步向上滑入到 0
 * - 动画结束后 top = bottom，bottom 清空，状态归零
 */
const FlipChar: React.FC<{ char: string }> = ({ char }) => {
  const [display, setDisplay] = useState<string>(char);
  const [next, setNext] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState<number>(0);
  const prevCharRef = useRef<string>(char);

  useEffect(() => {
    if (char !== prevCharRef.current) {
      setNext(char);
      setAnimKey((k) => k + 1);
      const t = window.setTimeout(() => {
        setDisplay(char);
        setNext(null);
      }, 420);
      prevCharRef.current = char;
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [char]);

  const animating = next !== null;

  return (
    <span className="flip-char relative inline-block overflow-hidden align-baseline w-[0.62em]">
      {/* 上层：当前显示值 */}
      <span
        className="flip-layer absolute inset-0 flex items-center justify-center"
        data-side="top"
        data-active={animating ? 'true' : 'false'}
        style={animating ? { animationName: 'flipTopOut' } : undefined}
      >
        {display}
      </span>
      {/* 下层：新字符，初始 translateY(100%) 被裁在盒子外 */}
      {animating && (
        <span
          className="flip-layer absolute inset-0 flex items-center justify-center"
          data-side="bottom"
          key={animKey}
          style={{ animationName: 'flipBottomIn' }}
        >
          {next}
        </span>
      )}
    </span>
  );
};

export const TopBar: React.FC = () => {
  const [now, setNow] = useState<string>(() => formatDateTime(new Date()));
  const [showQR, setShowQR] = useState(false);

  const tick = useCallback(() => {
    setNow(formatDateTime(new Date()));
  }, []);

  useEffect(() => {
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  // 二维码指向注册页：优先用配置的公网/局域网地址（VITE_PUBLIC_ORIGIN），否则取当前访问地址
  const publicOrigin =
    (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined) || window.location.origin;
  const registerUrl = `${publicOrigin.replace(/\/$/, '')}/register`;

  return (
    <>
      <header className="absolute z-20 left-0 right-0 top-0 h-[63px] flex items-center px-[37px] bg-[url('/bg.jpg')] bg-center bg-cover">
        {/* 左侧：扫码注册按钮（s.svg 图标，深色图标反白显示） */}
        <button
          type="button"
          aria-label="扫码录入"
          onClick={() => setShowQR(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
        >
          <img src="/s.svg" alt="" draggable={false} className="h-7 w-7 brightness-0 invert" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 font-extrabold italic tracking-wide text-[30px] text-white drop-shadow-sm">
          信息安全技术学院 ·  2026级新生欢迎会
        </div>
        <div className="ml-auto font-extrabold italic tracking-wide text-[16px] tabular-nums text-white drop-shadow-sm">
          {Array.from(now).map((ch, i) => (
            <FlipChar key={i} char={ch} />
          ))}
        </div>
      </header>

      {/* 二维码弹窗：扫码进入注册页 */}
      {showQR && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60"
          onClick={() => setShowQR(false)}
        >
          <div
            className="flex flex-col items-center rounded-2xl bg-white px-10 py-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-xl font-bold text-gray-900">扫码录入</div>
            <div className="rounded-lg border border-gray-200 p-3">
              <QRCodeSVG value={registerUrl} size={360} level="M" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
