import type { Budget, Expense } from "@/entities/expense";
import type { TripMember } from "@/entities/member";
import type { Stop } from "@/entities/stop";

export type TripStatus = "active" | "planning" | "settled";

export interface TripDay {
  number: number;
  /** ISO `YYYY-MM-DD` date for this itinerary day, or "" when unknown. */
  date: string;
  /** Legacy display label kept for imported data that has no ISO date. */
  dateLabel: string;
  city: string;
  color: string;
}

export interface TripSummaryMember {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarFg: string;
  image?: string | null;
  isCurrentUser: boolean;
}

export interface TripSummary {
  id: string;
  title: string;
  startLabel: string;
  endLabel: string;
  status: TripStatus;
  currency: string;
  coverColor: string;
  coverUrl: string | null;
  memberCount: number;
  stopCount: number;
  createdAt: string;
  creatorName: string;
  members: TripSummaryMember[];
  location: { lat: number; lng: number } | null;
}

/** The requesting user's effective permissions on a trip. */
export interface TripPermissions {
  isMember: boolean;
  canEdit: boolean;
  canInvite: boolean;
}

/** Wizard answers captured at create time. Omitted fields mean TBD. */
export interface TripIntake {
  destination?: string;
  destinationLat?: number;
  destinationLng?: number;
  dayCount?: number;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  partySize?: number;
}

export interface Trip {
  id: string;
  title: string;
  status: TripStatus;
  currency: string;
  /** Monotonic server revision for realtime and conflict detection. */
  version: number;
  startDate: string;
  coverUrl: string | null;
  intake: TripIntake | null;
  agentSeedPending: boolean;
  members: TripMember[];
  permissions: TripPermissions;
  days: TripDay[];
  stops: Stop[];
  expenses: Expense[];
  budget: Budget;
}
