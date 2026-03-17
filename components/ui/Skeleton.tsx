import React from "react";

type Props = { className?: string; style?: React.CSSProperties };

export function Skeleton({ className = "", style }: Props) {
  return <div className={`skeleton ${className}`} style={style} />;
}
