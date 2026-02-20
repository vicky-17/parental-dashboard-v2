// sw.js - Service Worker for Push Notifications

// Listen for incoming push messages from the server
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        // Customize how the notification looks on the phone/PC
        const options = {
            body: data.body,
            icon: data.icon || '/shield-icon.png', // Make sure you have a small image here
            badge: '/shield-icon.png', // Small icon for Android status bar
            vibrate: [200, 100, 200], // Vibration pattern
            data: {
                url: data.url || '/' // Where to go when clicked
            }
        };

        // Show the notification
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Listen for when the parent clicks the notification
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Close the notification pop-up
    
    // Open the dashboard URL in the browser
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});