console.log("Realtime trends script loaded");
document.addEventListener('DOMContentLoaded', () => {
    const socket = io.connect('http://localhost:5000');

    socket.on('connected', (data) => {
        console.log(data); // This should log {data: "Connected to server"}
    });

    // Ensure myChart is initialized before any data updates
    const ctx = document.getElementById('influxChart').getContext('2d');
    const myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Timestamps
            datasets: [{
                label: 'Real-time trend chart',
                data: [], // Values
                backgroundColor: 'rgba(255, 204, 0, 0.2)',
                borderColor: 'rgba(255, 204, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            },
            animation: {
                duration: 0 // Disable animation for real-time performance
            }
        }
    });

    socket.on('dataUpdate', (data) => {
        console.log('Data received:', data);
        updateResults(data); // Call function to update the results in the DOM
    });

    function updateResults(data) {
        const resultsDiv = document.getElementById('results');
        const ul = resultsDiv.querySelector('ul') || document.createElement('ul');

        console.log('Parsed data:', data); // Debugging: ensure data is correctly parsed

        const li = document.createElement('li');
        li.textContent = `Timestamp: ${data.timestamp}, Value: ${data.value}`;
        ul.appendChild(li);

        if (!resultsDiv.contains(ul)) {
            resultsDiv.appendChild(ul);
        }

        // Ensure the container scrolls to the bottom to show the latest data
        resultsDiv.scrollTop = resultsDiv.scrollHeight;

        // Update chart
        if (myChart) {
            myChart.data.labels.push(data.timestamp);
            myChart.data.datasets[0].data.push(data.value);
            myChart.update();
        }
    }

});
