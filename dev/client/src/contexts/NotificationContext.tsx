import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { fetchBackendNotifications, markBackendNotificationsRead } from "@/lib/api";

export type NotificationKind = "risk" | "task" | "system";
export type Notification = { id: string; kind: NotificationKind; title: string; body: string; createdAt: string; read: boolean };

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "n-welcome", kind: "system", title: "Briefing ready", body: "Two joiners are inside their final week.", createdAt: "Today", read: false },
  ]);

  const refreshNotifications = async () => {
    try {
      const backendNotifs = await fetchBackendNotifications();
      if (backendNotifs && backendNotifs.length > 0) {
        setNotifications(
          backendNotifs.map((n) => ({
            id: n.id,
            kind: (n.kind === "risk" || n.kind === "task" ? n.kind : "system") as NotificationKind,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt,
            read: n.read,
          }))
        );
      }
    } catch {
      // Offline / fallback to local state
    }
  };

  useEffect(() => {
    void refreshNotifications();
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    addNotification: (notification) => {
      const next = { ...notification, id: `n-${Date.now()}`, createdAt: "Just now", read: false };
      setNotifications((current) => [next, ...current].slice(0, 20));
      toast(notification.title, { description: notification.body });
    },
    markAllRead: () => {
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      void markBackendNotificationsRead().catch(() => {});
    },
    refreshNotifications,
  }), [notifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
