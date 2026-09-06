import React from 'react';
import TopBar from '@/components/TopBar';

interface PageLayoutProps {
  children?: React.ReactNode;
  hideTopBar?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, hideTopBar = false }) => {
  return (
    <div className="page relative w-screen h-screen min-h-[620px] overflow-hidden page-bg">
      {/* 居中 logo 背景层，置于底层，透明度 50% */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <img src="/logo.png" alt="logo" className="max-h-[1000px] w-auto opacity-10" />
      </div>
      {!hideTopBar && <TopBar />}
      <main className="relative z-10">{children}</main>
    </div>
  );
};

export default PageLayout;
