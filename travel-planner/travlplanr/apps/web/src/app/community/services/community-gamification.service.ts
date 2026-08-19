import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

/* ── Types ────────────────────────────────────────────── */

export interface TravelerLevel {
  rank: number;
  name: string;
  minXp: number;
  icon: string;
  color: string;
}

export const TRAVELER_LEVELS: TravelerLevel[] = [
  { rank: 1, name: 'Wanderer',      minXp: 0,    icon: '🌱', color: 'text-emerald-600' },
  { rank: 2, name: 'Explorer',      minXp: 200,  icon: '🧭', color: 'text-blue-600' },
  { rank: 3, name: 'Adventurer',    minXp: 600,  icon: '⛰️', color: 'text-indigo-600' },
  { rank: 4, name: 'Globe-Trotter', minXp: 1500, icon: '✈️', color: 'text-purple-600' },
  { rank: 5, name: 'Nomad',         minXp: 3500, icon: '🗺️', color: 'text-amber-600' },
  { rank: 6, name: 'Legend',        minXp: 7000, icon: '👑', color: 'text-rose-600' },
];

export interface TravelerBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'travel' | 'social' | 'special';
  earned: boolean;
  earnedAt?: string;
  progress?: number;   // 0-100
  requirement?: string; // e.g. "Post 10 times"
}

export interface GamificationProfile {
  xp: number;
  level: TravelerLevel;
  nextLevel: TravelerLevel | null;
  xpToNext: number;
  progressPercent: number;
  badges: TravelerBadge[];
  stats: {
    totalPosts: number;
    totalComments: number;
    totalReactions: number;
    totalSaves: number;
    countriesVisited: number;
    tripsCloned: number;
    peopleMentored: number;
  };
  streak: {
    current: number;
    longest: number;
    lastActivity: string;
  };
}

export interface XpEvent {
  action: string;
  xp: number;
  timestamp: string;
  description: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'daily' | 'weekly' | 'monthly' | 'seasonal';
  xpReward: number;
  progress: number;
  target: number;
  expiresAt: string;
  completed: boolean;
}

/* ── XP Values ────────────────────────────────────────── */

export const XP_VALUES: Record<string, number> = {
  post_create: 50,
  comment_add: 10,
  reaction_receive: 5,
  post_saved: 20,
  trip_cloned: 30,
  story_create: 25,
  follow_receive: 10,
  poll_vote: 5,
  qa_answer: 15,
  qa_accepted: 40,
  event_create: 30,
  event_rsvp: 10,
  journal_entry: 35,
  challenge_complete: 100,
  daily_login: 5,
};

/* ── Default Badges ───────────────────────────────────── */

export const ALL_BADGES: Omit<TravelerBadge, 'earned' | 'earnedAt' | 'progress'>[] = [
  { id: 'first_post',        name: 'First Steps',         description: 'Published your first community post', icon: '🎒', category: 'milestone', requirement: 'Create 1 post' },
  { id: 'ten_posts',         name: 'Storyteller',          description: 'Published 10 community posts',       icon: '📖', category: 'milestone', requirement: 'Create 10 posts' },
  { id: 'fifty_posts',       name: 'Content Creator',      description: 'Published 50 community posts',       icon: '🎬', category: 'milestone', requirement: 'Create 50 posts' },
  { id: 'first_comment',     name: 'Conversationalist',    description: 'Left your first comment',            icon: '💬', category: 'social',    requirement: 'Comment once' },
  { id: 'helpful_guide',     name: 'Helpful Guide',        description: 'Received 50 reactions on your posts', icon: '⭐', category: 'social',    requirement: '50 reactions received' },
  { id: 'community_mentor',  name: 'Community Mentor',     description: 'Helped 20 travelers with answers',   icon: '🤝', category: 'social',    requirement: 'Get 20 accepted answers' },
  { id: 'five_countries',    name: 'Border Crosser',       description: 'Visited 5 countries',                icon: '🌍', category: 'travel',    requirement: 'Visit 5 countries' },
  { id: 'ten_countries',     name: 'World Explorer',       description: 'Visited 10 countries',               icon: '🌏', category: 'travel',    requirement: 'Visit 10 countries' },
  { id: 'twentyfive_countries', name: 'Globe Master',      description: 'Visited 25 countries',               icon: '🏆', category: 'travel',    requirement: 'Visit 25 countries' },
  { id: 'budget_master',     name: 'Budget Master',        description: 'Shared 5 budget tips',               icon: '💰', category: 'travel',    requirement: 'Post 5 budget tips' },
  { id: 'solo_explorer',     name: 'Solo Explorer',        description: 'Tagged 3 solo trips',                icon: '🧭', category: 'travel',    requirement: 'Tag 3 solo trips' },
  { id: 'streak_7',          name: 'Weekly Streak',        description: '7-day activity streak',              icon: '🔥', category: 'special',   requirement: '7 consecutive days active' },
  { id: 'streak_30',         name: 'Monthly Streak',       description: '30-day activity streak',             icon: '💎', category: 'special',   requirement: '30 consecutive days active' },
  { id: 'collector',         name: 'Collector',            description: 'Saved 25 posts to collections',      icon: '📌', category: 'milestone', requirement: 'Save 25 posts' },
  { id: 'trip_cloner',       name: 'Trip Cloner',          description: 'Cloned 5 trips from the community',  icon: '✈️', category: 'milestone', requirement: 'Clone 5 trips' },
  { id: 'event_host',        name: 'Event Host',           description: 'Hosted your first community event',  icon: '🎉', category: 'social',    requirement: 'Create 1 event' },
];

/* ── Service ──────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class CommunityGamificationService {
  private readonly http = inject(HttpClient);

  /** Fetch the full gamification profile for the current user. */
  getProfile(): Observable<GamificationProfile> {
    return this.http.get<any>(apiUrl('/community/gamification/profile')).pipe(
      map(raw => this.mapProfile(raw))
    );
  }

  /** Fetch recent XP events (activity log). */
  getXpHistory(limit = 20): Observable<XpEvent[]> {
    return this.http.get<any[]>(apiUrl(`/community/gamification/xp-history?limit=${limit}`)).pipe(
      map(raw => (raw || []).map(e => this.mapXpEvent(e)))
    );
  }

  /** Fetch active challenges. */
  getChallenges(): Observable<Challenge[]> {
    return this.http.get<any[]>(apiUrl('/community/gamification/challenges')).pipe(
      map(raw => (raw || []).map(c => this.mapChallenge(c)))
    );
  }

  /** Get leaderboard for a given period. */
  getLeaderboard(period: 'weekly' | 'monthly' | 'alltime' = 'weekly', limit = 10): Observable<LeaderboardEntry[]> {
    return this.http.get<any[]>(apiUrl(`/community/gamification/leaderboard?period=${period}&limit=${limit}`)).pipe(
      map(raw => (raw || []).map((e, idx) => this.mapLeaderboardEntry(e, idx)))
    );
  }

  /* ── Helpers ──────────────────────────────────────── */

  getLevelForXp(xp: number): TravelerLevel {
    let level = TRAVELER_LEVELS[0];
    for (const l of TRAVELER_LEVELS) {
      if (xp >= l.minXp) level = l;
    }
    return level;
  }

  getNextLevel(current: TravelerLevel): TravelerLevel | null {
    const idx = TRAVELER_LEVELS.findIndex(l => l.rank === current.rank);
    return idx < TRAVELER_LEVELS.length - 1 ? TRAVELER_LEVELS[idx + 1] : null;
  }

  getProgressPercent(xp: number, current: TravelerLevel, next: TravelerLevel | null): number {
    if (!next) return 100;
    const range = next.minXp - current.minXp;
    if (range <= 0) return 100;
    return Math.min(100, Math.round(((xp - current.minXp) / range) * 100));
  }

  /** Backend returns: { xp, level (rank number), level_name, streak_days, badges: [{key,name,description,icon,earned_at}], next_level_xp } */
  private mapProfile(raw: any): GamificationProfile {
    const xp = raw.xp ?? 0;
    const level = TRAVELER_LEVELS.find(l => l.rank === raw.level) ?? this.getLevelForXp(xp);
    const nextLevel = this.getNextLevel(level);
    const xpToNext = raw.next_level_xp != null ? Math.max(0, raw.next_level_xp - xp) : 0;
    const badges: TravelerBadge[] = (raw.badges || []).map((b: any) => ({
      id: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: 'milestone',
      earned: true,
      earnedAt: b.earned_at,
    }));
    return {
      xp,
      level,
      nextLevel,
      xpToNext,
      progressPercent: this.getProgressPercent(xp, level, nextLevel),
      badges,
      stats: { totalPosts: 0, totalComments: 0, totalReactions: 0, totalSaves: 0, countriesVisited: 0, tripsCloned: 0, peopleMentored: 0 },
      streak: { current: raw.streak_days ?? 0, longest: raw.streak_days ?? 0, lastActivity: '' },
    };
  }

  /** Backend returns: [{ amount, reason, created_at }] */
  private mapXpEvent(raw: any): XpEvent {
    return {
      action: raw.reason,
      xp: raw.amount,
      timestamp: raw.created_at,
      description: this.describeXpReason(raw.reason),
    };
  }

  private describeXpReason(reason: string): string {
    const descriptions: Record<string, string> = {
      post_created: 'Created a post',
      comment_created: 'Left a comment',
      reaction_given: 'Reacted to a post',
      story_created: 'Shared a story',
      follow_given: 'Followed a traveler',
    };
    return descriptions[reason] ?? reason;
  }

  /** Backend returns: [{ key, title, description, target, progress, completed }] */
  private mapChallenge(raw: any): Challenge {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
    return {
      id: raw.key,
      title: raw.title,
      description: raw.description,
      icon: '🎯',
      type: 'weekly',
      xpReward: 50,
      progress: raw.progress ?? 0,
      target: raw.target ?? 1,
      expiresAt: weekEnd.toISOString(),
      completed: !!raw.completed,
    };
  }

  /** Backend returns: [{ customer_id, name, avatar, xp, level (rank number) }] */
  private mapLeaderboardEntry(raw: any, idx: number): LeaderboardEntry {
    const level = TRAVELER_LEVELS.find(l => l.rank === raw.level) ?? TRAVELER_LEVELS[0];
    return {
      rank: idx + 1,
      customerId: raw.customer_id,
      name: raw.name || 'Traveler',
      avatar: raw.avatar ?? null,
      xp: raw.xp ?? 0,
      level,
      countriesVisited: raw.countries_visited ?? 0,
    };
  }
}

/* ── Leaderboard Types ────────────────────────────────── */

export interface LeaderboardEntry {
  rank: number;
  customerId: string;
  name: string;
  avatar: string | null;
  xp: number;
  level: TravelerLevel;
  countriesVisited: number;
  isCurrentUser?: boolean;
}
