import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Standard VAPID Public Key generated for Zero Leak reminders
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
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
  };

  const subscribeUser = async () => {
    if (!isSupported || !profile) return false;
    setLoading(true);
    try {
      // 1. Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error('Permission not granted for notifications');
      }

      // 2. Subscribe to push manager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 3. Save subscription details to Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription.toJSON() })
        .eq('id', profile.id);

      if (error) throw error;
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Failed to subscribe user to push notifications:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    if (!isSupported || !profile) return false;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Clear from database
      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', profile.id);

      if (error) throw error;
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
    loading
  };
}
