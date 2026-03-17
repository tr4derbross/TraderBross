"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  className?: string;
  compact?: boolean;
};

const LOGO_SRC = "/Brand/logo.png";

function CompactFallback() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(242,183,5,0.25)] bg-[rgba(18,18,18,0.98)] shadow-[0_14px_32px_rgba(0,0,0,0.34)]">
      <span className="text-[13px] font-bold tracking-[0.18em] text-[#F2B705]">TB</span>
    </div>
  );
}

function FullFallback() {
  return (
    <div className="flex items-center gap-3">
      <CompactFallback />
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-[0.24em] text-[#FFFFFF]">TRADERBROSS</div>
        <div className="mt-1 text-[9px] tracking-[0.34em] text-[#6B6B6B]">MULTI-VENUE TERMINAL</div>
      </div>
    </div>
  );
}

export default function BrandMark({ className = "", compact = false }: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return <div className={className}>{compact ? <CompactFallback /> : <FullFallback />}</div>;
  }

  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        <Image
          src={LOGO_SRC}
          alt="TraderBross logo"
          width={compact ? 48 : 360}
          height={compact ? 48 : 108}
          priority
          unoptimized
          className={compact ? "h-11 w-auto object-contain" : "h-[4.4rem] w-auto object-contain md:h-[5rem] xl:h-[5.2rem]"}
          onError={() => setImageFailed(true)}
        />
      </div>
    </div>
  );
}
