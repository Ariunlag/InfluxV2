console.log("Influx script loaded");

document.addEventListener("DOMContentLoaded", function () {
    const socket = io(); // Connect to WebSocket server
    const section_id ='aggregate_query';

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
            
            populateMeasurementDropdown(data.measurements);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    // Populate measurement dropdown
    function populateMeasurementDropdown(measurements) {
        measurementSelect.innerHTML = ""; // Clear existing options
        measurements.forEach((measurement) => {
            if(measurement != 'user_queries'){
                const option = document.createElement("option");
                option.value = measurement;
                option.textContent = capitalize(measurement);
                measurementSelect.appendChild(option);
            }
           
        });
    }
    function capitalize(string) { return string.charAt(0).toUpperCase() + string.slice(1); }

    // Handle query form submission
    queryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Validate input
        if (!measurementSelect.value) {
            alert("Please select a measurement.");
            return;
        }
        const measurement = [measurementSelect.value];
        const timeRange = Array.from(timeRangeRadios).find((r) => r.checked)?.value || "last24Hours";
        const aggregation = Array.from(aggregationRadios).find((r) => r.checked)?.value || "average";

        
        // Clear the existing chart data
        influxChart.data.labels = [];
        influxChart.data.datasets = [];
        influxChart.update();

        try {
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ measurements: measurement, timeRange: timeRange, aggregation: aggregation, section_id: section_id })
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
    socket.onAny((event, args) => {
        if (event.startsWith("dataUpdate_")) {
            console.log(`Received event ${event}:`, args);
            current_section_id = event.replace("dataUpdate_", "");
            console.log(`Received ${args.length} records for ${current_section_id}`);
            
            if (current_section_id == section_id){
                // Process as array regardless of input type
                const dataArray = Array.isArray(args) ? args : [args];
                
                // Sort data by timestamp before processing
                dataArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // Batch processing with single chart update
                dataArray.forEach(data => processChartData(data));
                updateChartVisuals();
            }
        }
    });

    function binarySearch(arr, timestamp) {
        let low = 0, high = arr.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (arr[mid].x < timestamp) low = mid + 1;
            else high = mid;
        }
        return arr[low]?.x === timestamp ? low : ~low;
    }

    function updateChartVisuals() {
        influxChart.options.scales.x.time.unit = 'hour';
        influxChart.update({
            duration: 0,
            lazy: true,
            preservation: {
                x: ['userPan', 'userZoom'] 
            }
        });
    }


    function processChartData(data) {
        let dataset = influxChart.data.datasets.find(d => d.label === data.measurement);
        
        if (!dataset) {
            dataset = {
                label: data.measurement,
                data: [],
                borderColor: getRandomColor(),
                fill: false,
                lineTension: 0.1,
                pointRadius: 2
            };
            influxChart.data.datasets.push(dataset);
        }

        const timestamp = new Date(data.timestamp);
        console.log("Processing data:", { x: timestamp, y: data.value });

        const index = binarySearch(dataset.data, timestamp);
        
        if (index <0) {
            dataset.data.splice(~index, 0, { x: timestamp, y: data.value });
            console.log("Dataset after insertion:", dataset.data);
            
            if (dataset.data.length > 200) {
                dataset.data.splice(0, dataset.data.length - 200);
            }
        }
    }
    // Generate random colors for chart lines
    function getRandomColor() {
        return `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    }

    // Fetch initial measurement data
    fetchData();
});
