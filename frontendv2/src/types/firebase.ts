/**
 * Firebase Types
 * Type definitions for Firebase Auth, Database, and Storage
 */

import type { User as FirebaseUser } from 'firebase/auth';

// ============================================================================
// Authentication
// ============================================================================

export interface AuthUser extends FirebaseUser {
  // Additional custom fields
  customClaims?: Record<string, unknown>;
}

export type AuthProvider = 'email' | 'google' | 'anonymous';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// ============================================================================
// User Profile
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string;
  stats: UserStats;
  preferences: UserPreferences;
}

export interface UserStats {
  totalGames: number;
  totalPuzzlesSolved: number;
  averageSolveTime: number;
  bestSolveTime: number;
  gamesWon: number;
  gamesLost: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  soundEffects: boolean;
  hapticFeedback: boolean;
  autoCheck: boolean;
  showTimer: boolean;
  publicProfile: boolean;
}

// ============================================================================
// Realtime Database
// ============================================================================

export interface PresenceData {
  uid: string;
  displayName: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  currentGame?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  edited?: boolean;
  editedAt?: number;
}

export interface GameSnapshot {
  gid: string;
  pid: string;
  createdAt: number;
  updatedAt: number;
  players: string[];
  completed: boolean;
  completedAt?: number;
}

// ============================================================================
// Cloud Storage
// ============================================================================

export interface StorageUpload {
  file: File;
  path: string;
  metadata?: StorageMetadata;
}

export interface StorageMetadata {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageFile {
  name: string;
  fullPath: string;
  size: number;
  contentType: string;
  downloadURL: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Security
// ============================================================================

export interface SecurityRules {
  read: boolean;
  write: boolean;
  validate?: boolean;
}

export type FirebaseError = {
  code: string;
  message: string;
  name: string;
};
