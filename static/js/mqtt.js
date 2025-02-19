let subscribedTopics = []; // Global list of subscribed topics
console.log("MQTT script loaded");


$(document).ready(function() {
    function updateSubscribedTopics() {
        // Target the <li> with the class "subscribrdTopics" inside #subscribed-topics.
        const topicDisplay = $('#subscribed-topics .subscribedTopics');
        if (subscribedTopics.length > 0) {
            // Display as a comma-separated list.
            topicDisplay.text(subscribedTopics.join(", "));
        } else {
            topicDisplay.text("No subscriptions yet");
        }
    }

    function fetchSubscribedTopics() {
        $.ajax({
            type: 'GET',
            url: '/get_subscribed_topics', // Backend should return the list of already subscribed topics
            success: function(response) {
                if (response.success && response.topics) {
                    subscribedTopics = response.topics; // Load topics from backend
                    updateSubscribedTopics(); // Update UI
                }
            },
            error: function(xhr, status, error) {
                console.log("Error fetching subscribed topics:", error);
            }
        });

    }
    fetchSubscribedTopics();
    

    $('#subscribeForm').submit(function(event) {
        event.preventDefault();

        let topic = $('#mqtt_topic_subscribe').val().trim();
        if (!topic) return; // Prevent empty subscriptions

        if (!subscribedTopics.includes(topic)) {
            $.ajax({
                type: 'POST',
                url: '/subscribe',
                data: { mqtt_topic: topic },
                success: function(response) {
                    console.log("Subscribe response:", response);
                    if (response.success) {
                        subscribedTopics.push(topic);
                        updateSubscribedTopics();
                        $('#responseMessage').text('Subscribed successfully').css('color', 'green');
                    } else {
                        $('#responseMessage').text(response.message).css('color', 'red');
                    }
                },
                error: function(xhr, status, error) {
                    console.log("Subscribe error:", error);
                    $('#responseMessage').text("Subscription failed").css('color', 'red');
                },
                complete: function() {
                    $('#mqtt_topic_subscribe').val(''); // Clear input field always
                }
            });
        } else {
            $('#responseMessage').text("Already subscribed to this topic").css('color', 'orange');
            $('#mqtt_topic_subscribe').val('');
        }
    });

    $('#unsubscribeForm').submit(function(event) {
        event.preventDefault();

        let topic = $('#mqtt_topic_unsubscribe').val().trim();
        if (!topic) return;

        const index = subscribedTopics.indexOf(topic);
        if (index > -1) {
            $.ajax({
                type: 'POST',
                url: '/unsubscribe',
                data: { mqtt_topic: topic },
                success: function(response) {
                    console.log("Unsubscribe response:", response);
                    if (response.success) {
                        subscribedTopics.splice(index, 1);
                        updateSubscribedTopics();
                        $('#responseMessage').text('Unsubscribed successfully').css('color', 'green');
                    } else {
                        $('#responseMessage').text(response.message).css('color', 'red');
                    }
                },
                error: function(xhr, status, error) {
                    console.log("Unsubscribe error:", error);
                    $('#responseMessage').text("Unsubscription failed").css('color', 'red');
                },
                complete: function() {
                    $('#mqtt_topic_unsubscribe').val('');
                }
            });
        } else {
            $('#responseMessage').text("Topic not found in subscription list").css('color', 'orange');
            $('#mqtt_topic_unsubscribe').val('');
        }
    });

    // Display incoming MQTT data
    var socket = io();

    socket.on('connect', function() {
        console.log('Socket.IO connected');
    });

    socket.on('mqtt_data', function(msg) {
        console.log("Received data:", msg);
        var ul = document.getElementById('mqtt-data-display');

        // No need to clear previous messages - this keeps the history
        msg.data.forEach(function(item) {
            if (item) {
                var li = document.createElement('li');
                li.innerHTML = `
                    <strong>Topic:</strong> ${item.topic}&nbsp;&nbsp;&nbsp;
                    <strong>Field:</strong> ${Object.entries(item.fields).map(([key, value]) => `${value}`).join(', ')}
                    <br> `;
                li.className = 'mqtt-item';
                ul.insertBefore(li, ul.firstChild || null);
            }
        });
    });

});
