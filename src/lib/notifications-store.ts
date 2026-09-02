import { useSyncExternalStore } from "react";
import { CalendarClock, Car } from "lucide-react";
import { notifications as seed, type Notification } from "@/lib/notifications-data";

const STORAGE_KEY = "procion.notifications.v1";
let items: Notification[] = seed;
const listeners = new Set<() => void>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as {
      readIds?: string[];
      calendar?: Array<Omit<Notification, "icon">>;
    };
    const readIds = new Set(state.readIds || []);
    const calendar = (state.calendar || []).map((item) => ({
      ...item,
      icon: item.tone === "warning" ? Car : CalendarClock,
    }));
    items = [...calendar, ...seed].map((item) => ({
      ...item,
      read: item.read || readIds.has(item.id),
    }));
  } catch {
    items = seed;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      readIds: items.filter((item) => item.read).map((item) => item.id),
      calendar: items
        .filter((item) => item.id.startsWith("calendar:"))
        .map(({ icon: _icon, ...item }) => item),
    }),
  );
}

function emit() {
  persist();
  listeners.forEach((listener) => listener());
}

export function addNotification(notification: Notification) {
  hydrate();
  if (items.some((item) => item.id === notification.id)) return false;
  items = [notification, ...items];
  emit();
  return true;
}

export function markAllNotificationsRead() {
  hydrate();
  items = items.map((item) => ({ ...item, read: true }));
  emit();
}

export function markNotificationRead(id: string) {
  hydrate();
  items = items.map((item) => (item.id === id ? { ...item, read: true } : item));
  emit();
}

export function useNotifications() {
  hydrate();
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => items,
    () => seed,
  );
}
