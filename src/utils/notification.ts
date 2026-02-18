export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support desktop notification');
        return false;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    return permission === 'granted';
}

export function playAlertSound() {
    const audio = new Audio('/alert.mp3');
    audio.volume = 1.0;
    audio.play().catch(err => console.error('Error playing audio:', err));
}

export async function sendMockNotification(title: string, body: string, data: Record<string, unknown> = {}) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        if (Notification.permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;

            // Vibration
            if (navigator.vibrate) {
                navigator.vibrate([500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450]);
            }

            registration.showNotification(title, {
                body: body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                data: { ...data, url: window.location.origin + `/orders/${(data as { orderId?: string }).orderId}` },
            } as NotificationOptions);
        }
    } else {
        console.warn('Service Worker not ready or notifications not granted');
    }
}
