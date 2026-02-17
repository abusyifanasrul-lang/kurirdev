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

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
                    // Play sound if foreground
                    playAlertSound();

                    // Optional: Trigger a toast or other UI update
                    console.log('Foreground notification received:', event.data.payload);
                }
            });
        });
    }
}

export async function sendMockNotification(title: string, body: string, data: any = {}) {
    // Check if we can use the SW to show a notification (simulating a push)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // In a real app, this would be triggering a backend API that sends a Web Push
        // For simulation, we can try to use showNotification directly if we have permission
        if (Notification.permission === 'granted') {
            // Simulate the "Push" behavior by calling showNotification from the registration
            const registration = await navigator.serviceWorker.ready;

            // Note: This shows the notification but doesn't trigger the 'push' event in SW 
            // exactly like a real push. To trigger the 'push' event logic (like vibration), 
            // we might need to rely on the fact that we are calling showNotification here 
            // OR send a message to SW to tell it to show notification.
            // Let's send a message to SW to simulate a push event handling

            // Ideally we want to test the SW 'push' handler. 
            // But we can't easily synthetize a 'push' event from the client.
            // So we will directly invoke the desired effects (audio/vibration) here for the 'Wow' effect demonstration
            // and show the notification.

            // Vibration
            if (navigator.vibrate) {
                navigator.vibrate([500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450]);
            }

            // Audio is handled by the caller or foreground logic usually.

            registration.showNotification(title, {
                body: body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-96.png',
                vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450],
                data: { ...data, url: window.location.origin + `/orders/${data.orderId}` },
                actions: [
                    { action: 'view-detail', title: 'LIHAT DETAIL' }
                ]
            });
        }
    } else {
        console.warn('Service Worker not ready or notifications not granted');
    }
}
