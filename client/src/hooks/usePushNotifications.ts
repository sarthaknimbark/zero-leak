import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const VAPID_PUBLIC_KEY = 'BLRDmTUkWXSM5WwcP6xyjfYPmL-sHIJO1LfeEQxBbOt3TKsF11JTpH14UZDpOxlZR4FozkRxUW3vs0xPFdDUunQ';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [profile]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
  };

  const subscribeUser = async () => {
    if (!isSupported || !profile) {
      throw new Error('Notifications are not supported in this browser');
    }
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) => {
          window.setTimeout(() => reject(new Error('Notification service did not start. Refresh and try again.')), 8000);
        }),
      ]);
      const activeRegistration = ready || registration;

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error('Allow notifications in the browser prompt to turn this on');
      }

      const subscription = await activeRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ push_subscription: subscription.toJSON() }),
      });
      setIsSubscribed(true);

      try {
        await api('/api/notifications/test', { method: 'POST' });
      } catch {
        await activeRegistration.showNotification('Zero Leak', {
          body: 'Device alerts are on. Due bills will show up here.',
          icon: '/favicon.svg',
        });
      }
      return true;
    } catch (e) {
      console.error('Failed to subscribe user to push notifications:', e);
      throw e instanceof Error ? e : new Error('Could not enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    if (!isSupported || !profile) return false;
    setLoading(true);
    try {
      const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ push_subscription: null }),
      });
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Failed to unsubscribe user:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    subscribeUser,
    unsubscribeUser,
    loading,
  };
}
