'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell, BellOff, ShieldAlert, AlertTriangle, Info, CheckCircle,
  X, RefreshCw, Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: number;
  isRead: boolean;
  createdAt: string;
}

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  success: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AlertsPanel({ isOpen, onClose }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts?limit=30');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      console.error('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const generateAlerts = async () => {
    try {
      const res = await fetch('/api/alerts/generate', { method: 'POST' });
      const data = await res.json();
      toast.success(data.message || `Generated ${data.created} alert(s)`);
      fetchAlerts();
    } catch {
      toast.error('Failed to generate alerts');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(alerts.filter(a => !a.isRead).map(a => markAsRead(a.id)));
      toast.success('All alerts marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert dismissed');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-background shadow-2xl border-l border-border/60 flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200/60 shadow-sm">
              <Bell className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-[10px] text-muted-foreground font-medium">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-[10px] gap-1 rounded-lg text-muted-foreground hover:text-foreground">
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={generateAlerts} disabled={loading} className="h-7 text-[10px] gap-1 rounded-lg">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Scan
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-lg">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="p-3 rounded-2xl bg-muted/50 mb-3">
                <BellOff className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">No notifications</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Click &quot;Scan&quot; to analyze your cash flow</p>
            </div>
          )}

          {alerts.map((alert) => {
            const config = typeConfig[alert.type] || typeConfig.info;
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={`ring-1 ${config.border} ${alert.isRead ? 'opacity-60' : ''} shadow-sm hover:shadow-md transition-all duration-200`}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold ${config.color} truncate`}>{alert.title}</p>
                        <span className="text-[9px] text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                          {formatTimeAgo(alert.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">{alert.message}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {!alert.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(alert.id)}
                            className="h-6 text-[9px] px-2 rounded-md gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <CheckCircle className="w-2.5 h-2.5" />
                            Mark read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAlert(alert.id)}
                          className="h-6 text-[9px] px-2 rounded-md gap-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
