export type EventCategory =
  | "tokenUnlock"
  | "hardFork"
  | "upgrade"
  | "conference"
  | "listing"
  | "mainnet"
  | "regulation"
  | "airdrop";

export interface CalendarEvent {
  id: string;
  title: string;
  coin: string;
  coinSymbol: string;
  date: string;
  category: EventCategory;
  description: string;
  source: string;
  importance: "high" | "medium" | "low";
}
