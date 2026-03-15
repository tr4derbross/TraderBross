"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error box, e.g. "News Feed" */
  label?: string;
  /** If true, fills entire height; otherwise compact inline error */
  fullHeight?: boolean;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Silent in prod; log in dev
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { label = "Panel", fullHeight = true } = this.props;

    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 px-4 text-center ${
          fullHeight ? "h-full min-h-[120px]" : "min-h-[80px] rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-rose-300">{label} failed to load</p>
          <p className="mt-0.5 max-w-[220px] text-[10px] leading-relaxed text-zinc-600">
            {this.state.message.slice(0, 120)}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:border-white/16 hover:text-zinc-200"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }
}
