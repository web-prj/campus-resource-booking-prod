import { useSyncExternalStore } from "react";
import type { User } from "./types";

// After logging in, we remember who the user is in the browser's localStorage.
// It only holds the public profile (id, name, email): no password, no token.
const STORAGE_KEY = "currentUser";

// A custom event so every component showing the user updates right away.
const CHANGE_EVENT = "current-user-change";

// Remember the logged-in user.
export function saveCurrentUser(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Forget the user (log out).
export function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // "storage" fires when another browser tab logs in or out.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can be blocked (e.g. some private windows).
    return null;
  }
}

// On the server there is no localStorage, so we cannot know yet.
function getServerSnapshot(): undefined {
  return undefined;
}

// React hook that gives back:
// - the logged-in user,
// - null if nobody is logged in,
// - undefined on the very first render, before the browser has checked.
export function useCurrentUser(): User | null | undefined {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (saved === undefined) return undefined;
  if (!saved) return null;
  try {
    return JSON.parse(saved) as User;
  } catch {
    return null;
  }
}
