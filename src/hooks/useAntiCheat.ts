import { useEffect, useRef, useState, useCallback } from 'react';
import { api, CurrentUser } from '../lib/api.ts';
import { Team, PenaltyConfig } from '../types/index.ts';

interface AntiCheatOptions {
  team: Team | null;
  currentUser: CurrentUser | null;
  activeTaskId: string | null;
  penalties: PenaltyConfig | null;
  onStrikeReceived?: (strikeCount: number, penalty: number, flagged: boolean) => void;
}

export interface AntiCheatState {
  isFullscreen: boolean;
  isAway: boolean;
  awaySeconds: number;
  strikes: number;
  isFlagged: boolean;
  warningMessage: string | null;
  requestFullscreen: () => Promise<void>;
  dismissWarning: () => void;
}

export function useAntiCheat({
  team,
  currentUser,
  activeTaskId,
  penalties,
  onStrikeReceived,
}: AntiCheatOptions): AntiCheatState {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);
  const [isAway, setIsAway] = useState<boolean>(false);
  const [awaySeconds, setAwaySeconds] = useState<number>(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const clientSequenceRef = useRef<number>(1);
  const awayStartTimeRef = useRef<number | null>(null);
  const awayTimerRef = useRef<any>(null);

  // Sync strikes from team prop
  const strikes = team?.strikes || 0;
  const isFlagged = team?.isFlagged || false;

  // Dispatch event to server
  const sendEvent = useCallback(
    async (
      eventType: 'visibilitychange' | 'blur' | 'focus' | 'fullscreenchange' | 'paste',
      durationSec = 0
    ) => {
      if (!team?.id || !currentUser || !activeTaskId) return;

      const seq = clientSequenceRef.current++;
      const now = Date.now();

      try {
        const result = await api.sendAntiCheatEvent(
          team.id,
          {
            eventType,
            clientSequence: seq,
            clientTimestamp: now,
            awayDurationSeconds: durationSec,
          },
          currentUser
        );

        if (result.isStrike) {
          if (onStrikeReceived) {
            onStrikeReceived(result.strikeCount, result.penaltyApplied, result.isFlagged);
          }

          if (result.isFlagged) {
            setWarningMessage(
              `WARNING: Team has accumulated ${result.strikeCount} strikes and has been flagged for administrator review.`
            );
          } else if (result.penaltyApplied > 0) {
            setWarningMessage(
              `PENALTY APPLIED: Strike #${result.strikeCount} recorded for being away >3s (-${result.penaltyApplied} points deducted to ledger).`
            );
          } else {
            setWarningMessage(
              `WARNING: Tab switch / away event detected (${durationSec.toFixed(1)}s). Strike #${result.strikeCount} of 2 free warnings. Further strikes deduct 10 points.`
            );
          }
        }
      } catch (err) {
        console.warn('Failed to send anti-cheat event:', err);
      }
    },
    [team?.id, currentUser, activeTaskId, onStrikeReceived]
  );

  // Fullscreen helper
  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request denied or not supported:', err);
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setWarningMessage(null);
  }, []);

  // Monitor Fullscreen Change
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);

      if (activeTaskId) {
        sendEvent('fullscreenchange', 0);
        if (!active) {
          setWarningMessage('Task active: Fullscreen mode is mandatory. Please return to fullscreen.');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [activeTaskId, sendEvent]);

  // Away time tracking (Blur / Focus / Visibility)
  useEffect(() => {
    if (!activeTaskId) return;

    const handleWindowBlur = () => {
      setIsAway(true);
      awayStartTimeRef.current = Date.now();

      // Real-time away seconds ticker for UI display
      awayTimerRef.current = setInterval(() => {
        if (awayStartTimeRef.current) {
          const sec = Math.floor((Date.now() - awayStartTimeRef.current) / 1000);
          setAwaySeconds(sec);
        }
      }, 500);

      sendEvent('blur', 0);
    };

    const handleWindowFocus = () => {
      if (awayTimerRef.current) {
        clearInterval(awayTimerRef.current);
        awayTimerRef.current = null;
      }

      let duration = 0;
      if (awayStartTimeRef.current) {
        duration = (Date.now() - awayStartTimeRef.current) / 1000;
        awayStartTimeRef.current = null;
      }

      setIsAway(false);
      setAwaySeconds(0);

      sendEvent('focus', duration);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleWindowBlur();
      } else {
        handleWindowFocus();
      }
    };

    const handlePaste = () => {
      sendEvent('paste', 0);
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('paste', handlePaste);

    return () => {
      if (awayTimerRef.current) clearInterval(awayTimerRef.current);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('paste', handlePaste);
    };
  }, [activeTaskId, sendEvent]);

  return {
    isFullscreen,
    isAway,
    awaySeconds,
    strikes,
    isFlagged,
    warningMessage,
    requestFullscreen,
    dismissWarning,
  };
}
