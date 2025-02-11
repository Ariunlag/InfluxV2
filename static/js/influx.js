console.log("Influx script loaded");

document.addEventListener("DOMContentLoaded", function () {
    const socket = io(); // Connect to WebSocket server

    // DOM elements
    const queryForm = document.getElementById("queryForm");
    const measurementSelect = document.getElementById("measurement");
    const timeRangeRadios = document.querySelectorAll('input[name="timeRange"]');
    const aggregationRadios = document.querySelectorAll('input[name="aggregation"]');
    const influxChartCanvas = document.getElementById("influxChart");

    // Chart.js setup
    let influxChart = new Chart(influxChartCanvas, {
        type: "line",
        data: {
            labels: [], // X-axis: timestamps
            datasets: []
        },
        options: {
            responsive: true,
            scales: {
                x: { 
                    type: "time", 
                    time: { unit: "hour" },  // Ensure 'time' options are defined
                    title: { display: true, text: "Time" }
                },
                y: { beginAtZero: true, title: { display: true, text: "Value" } }
            }
        }
    });

    // Fetch available measurements
    async function fetchData() {
        try {
            console.log("Fetching available measurements...");
            const response = await fetch("/api/data");

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            console.log("Data fetched:", data);
            populateMeasurementDropdown(data.measurements);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    // Populate measurement dropdown
    function populateMeasurementDropdown(measurements) {
        measurementSelect.innerHTML = ""; // Clear existing options
        measurements.forEach((measurement) => {
            const option = document.createElement("option");
            option.value = measurement;
            option.textContent = measurement.charAt(0).toUpperCase() + measurement.slice(1);
            measurementSelect.appendChild(option);
        });
    }

    // Handle query form submission
    queryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Validate input
        if (!measurementSelect.value) {
            alert("Please select a measurement.");
            return;
        }

        const timeRange = Array.from(timeRangeRadios).find((r) => r.checked)?.value || "last24Hours";
        const aggregation = Array.from(aggregationRadios).find((r) => r.checked)?.value || "average";

        const query = {
            measurements: [measurementSelect.value],
            timeRange,
            aggregation
        };

        console.log("Submitting query:", query);

        // Clear the existing chart data
        influxChart.data.labels = [];
        influxChart.data.datasets = [];
        influxChart.update();

        try {
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(query)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            console.log("Query result:", result);
        } catch (error) {
            console.error("Error submitting query:", error);
            alert("Error submitting query. Please try again.");
        }
    });


    // Listen for real-time data updates
    socket.onAny((event, data) => {
        if (event.startsWith("dataUpdate_")) {
            console.log(`Received event ${event}:`, data);
            updateChart(data, event.replace("dataUpdate_", ""));
        }
    });

        // Ensure the measurement is in the dataset
        function updateChart(data, sectionId) {
            console.log("Updating chart with data:", data, "Section:", sectionId);

            let dataset = influxChart.data.datasets.find((d) => d.label === data.measurement);
    
            if (!dataset) {
                dataset = {
                    label: data.measurement,
                    data: [],
                    borderColor: getRandomColor(),
                    fill: false,
                    spanGaps: false // ✅ Prevents connecting first and last points
                };
                influxChart.data.datasets.push(dataset);
            }

            // Ensure unique timestamps (no duplicate entries)
            const lastTimestamp = dataset.data.length > 0 ? dataset.data[dataset.data.length - 1].x : null;

            if (lastTimestamp !== data.timestamp) {
                dataset.data.push({ x: data.timestamp, y: data.value }); // ✅ Append only latest data
                influxChart.data.labels.push(data.timestamp);
            }

            influxChart.update();
        }


    // Generate random colors for chart lines
    function getRandomColor() {
        return `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    }

    // Fetch initial measurement data
    fetchData();
});
