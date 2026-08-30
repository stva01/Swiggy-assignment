/* Logic layer notifications: local event bus today, replaceable with FastAPI SSE/WebSocket events later. */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type NotificationKind = "risk" | "task" | "system";
export type Notification = { id: string; kind: NotificationKind; title: string; body: string; createdAt: string; read: boolean };

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "n-welcome", kind: "system", title: "Briefing ready", body: "Two joiners are inside their final week.", createdAt: "Today", read: false },
  ]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    addNotification: (notification) => {
      const next = { ...notification, id: `n-${Date.now()}`, createdAt: "Just now", read: false };
      setNotifications((current) => [next, ...current].slice(0, 20));
      toast(notification.title, { description: notification.body });
    },
    markAllRead: () => setNotifications((current) => current.map((item) => ({ ...item, read: true }))),
  }), [notifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
