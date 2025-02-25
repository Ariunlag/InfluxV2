let subscribedTopics = []; // Global list of subscribed topics
console.log("MQTT script loaded");

document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const section_id = 'mqtt';

    // DOM elements
    const subscribeForm = document.getElementById('subscribeForm');
    const unsubscribeForm = document.getElementById('unsubscribeForm');
    const subscribedTopicsElement = document.querySelector('#subscribed-topics .subscribedTopics');
    const mqttDataDisplay = document.getElementById('mqtt-data-display');

    // Fetch subscribed topics on page load
    async function fetchSubscribedTopics() {
        try {
            const response = await fetch('/get_subscribed_topics', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success && data.topics) {
                subscribedTopics = data.topics;
                updateSubscribedTopics();
            }
        } catch (error) {
            console.error('Error fetching subscribed topics:', error);
        }
    }

    // Update the UI with the list of subscribed topics
    function updateSubscribedTopics() {
        if (subscribedTopicsElement) {
            subscribedTopicsElement.textContent = subscribedTopics.length > 0
                ? subscribedTopics.join(', ')
                : 'No subscriptions yet';
        } else {
            console.error('Element with class "subscribedTopics" not found');
        }
    }

    subscribeForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const topicInput = document.getElementById('mqtt_topic_subscribe'); 
        const topic = topicInput.value.trim();
        console.log('Subscribing to topic:', topic);
        if(!topic) return alert('Please enter a topic to subscribe to');

        try { 
            const response = await fetch('/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mqtt_topic: topic })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) {
                subscribedTopics.push(topic);
                updateSubscribedTopics();
                console.log('Subscribed successfully:', topic);
                topicInput.value = '';
            } else {
                console.error('Subscription failed:', data.message);
            }
        } catch (error) {
            console.error('Error subscribing to topic:', error);
        }
    });

    unsubscribeForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const topicInput = document.getElementById('mqtt_topic_unsubscribe'); 
        const topic = topicInput.value.trim();
        if(!topic) return alert('Please enter a topic to unsubscribe from');

        try {
            const response = await fetch('/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mqtt_topic: topic })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) {
                const index = subscribedTopics.indexOf(topic);
                if (index > -1) {
                    subscribedTopics.splice(index, 1);
                    updateSubscribedTopics();
                    console.log('Unsubscribed successfully:', topic);
                    topicInput.value = '';
                }
            } else {
                console.error('Unsubscription failed:', data.message);
            }
        } catch (error) {
            console.error('Error unsubscribing from topic:', error);
        }
    });

    

    // Fetch subscribed topics when the page loads
    fetchSubscribedTopics();

    // Handle incoming MQTT data
    socket.on('mqtt_data', (data) => {
        console.log('Received data:', data);
        if (mqttDataDisplay) {
            data.data.forEach((item) => {
                if (item) {
                    const li = document.createElement('li');
    
                    // Extract timestamp and value dynamically
                    const timestamp = item.fields.timestamp;
                    let value;
                    let fieldName;
    
    
                    for (const field in item.fields) {
                        if (field !== "timestamp") {
                            value = item.fields[field];
                            fieldName = field;
                            break; // Exit loop after finding the value
                        }
                    }
    
                    if (value !== undefined && fieldName) { // Check if value and fieldName are found
                        li.innerHTML = `
                            <strong>Topic:</strong> ${item.topic} &emsp;
                            <strong>Value:</strong> ${value}&emsp;
                            <strong>Time:</strong> ${timestamp}
                        `;
                        li.className = 'mqtt-item';
                        mqttDataDisplay.insertBefore(li, mqttDataDisplay.firstChild || null);
                    } else {
                        console.log("No value field found in item:", item);
                    }
                }
            });
        } else {
            console.error('Element with id "mqtt-data-display" not found');
        }
    });

    // Handle Socket.IO errors
    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
    });
});

