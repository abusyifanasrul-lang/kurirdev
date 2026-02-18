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
            // Register enhanced service worker untuk instant delivery
            navigator.serviceWorker.register('/sw-enhanced.js')
                .then(registration => {
                    console.log('[SW] Enhanced PWA registered: ', registration);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New version available
                                    console.log('[SW] New version available');
                                    // Show update notification to user
                                    if (confirm('New version available! Reload to update?')) {
                                        window.location.reload();
                                    }
                                }
                            });
                        }
                    });
                })
                .catch(registrationError => {
                    console.log('[SW] Enhanced PWA registration failed: ', registrationError);
                    
                    // Fallback to basic service worker
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {
                            console.log('[SW] Basic PWA registered: ', registration);
                        })
                        .catch(error => {
                            console.log('[SW] Basic PWA registration failed: ', error);
                        });
                });

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
                    // Play sound if foreground
                    playAlertSound();

                    // Handle real-time updates
                    console.log('[SW] Foreground notification received:', event.data.payload);
                    
                    // Trigger UI update if needed
                    if (event.data.payload.priority === 'urgent') {
                        // Dispatch custom event for urgent updates
                        window.dispatchEvent(new CustomEvent('urgent-order-update', {
                            detail: event.data.payload
                        }));
                    }
                }
                
                if (event.data && event.data.type === 'REAL_TIME_UPDATE') {
                    // Handle real-time data updates
                    console.log('[SW] Real-time update received:', event.data.payload);
                    
                    // Dispatch event for components to listen
                    window.dispatchEvent(new CustomEvent('real-time-data-update', {
                        detail: event.data.payload
                    }));
                }
                
                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                    // Handle notification actions
                    console.log('[SW] Notification action received:', event.data);
                    
                    // Dispatch event for components to handle
                    window.dispatchEvent(new CustomEvent('notification-action', {
                        detail: event.data
                    }));
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
                data: { ...data, url: window.location.origin + `/orders/${data.orderId}` }
            });
        }
    } else {
        console.warn('Service Worker not ready or notifications not granted');
    }
}
