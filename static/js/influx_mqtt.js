console.log("Influx MQTT script loaded");

document.addEventListener("DOMContentLoaded", () => {
    const activeMeasurements = new Set(); // Store active measurements
    const section_id = "influx-mqtt";
    const socket = io();
    let mqttEnabled = false; 

    // DOM Elements
    const runQueryButton = document.getElementById("run-query");
    const deleteQueryButton = document.getElementById("delete-query");
    const queryList = document.getElementById("query-list");
    const chartCanvas = document.getElementById("realTimeChart");

    // Initialize Chart
    let realTimeChart = new Chart(chartCanvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            scales: {
                x: { type: "time", time: { unit: "minute" }, title: { display: true, text: "Time" } },
                y: { beginAtZero: true, title: { display: true, text: "Value" } }
            }
        }
    });

    // Fetch saved queries from server
    async function fetchSavedQueries() {
        try {
            const response = await fetch("/api/user_queries", { method: "GET", headers: { "Content-Type": "application/json" } });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            data.queries ? populateSavedQueries(data.queries) : console.error("No queries found.");
        } catch (error) {
            console.error("Error fetching saved queries:", error);
        }
    }

    // Populate saved queries in the list
    function populateSavedQueries(queries) {
        queryList.innerHTML = ""; // Clear list
        queries.length
            ? queries.forEach(query => createQueryListItem(query))
            : (queryList.innerHTML = "<li>No saved queries found</li>");
    }

    function createQueryListItem(query) {
        const listItem = document.createElement("li");
        listItem.textContent = query.query_name;
        listItem.dataset.value = query.query_name;
        listItem.dataset.measurements = JSON.stringify(query.query_structure?.measurements || []);

        listItem.addEventListener("click", () => {
            queryList.querySelectorAll("li").forEach(item => item.classList.remove("selected"));
            listItem.classList.add("selected");
        });

        queryList.appendChild(listItem);
    }

    // Run Query (Fetch Historical Data)
    runQueryButton.addEventListener("click", async () => {
        
        const selectedOption = queryList.querySelector("li.selected");
        if (!selectedOption) return alert("Please select a query to run.");

        const queryName = selectedOption.dataset.value;
        resetChartData(); 
        
        
        try {
            const response = await fetch(`/api/realtime/${queryName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timeRange: null, aggregation: null, section_id })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            // Process historical data from response
            const data = await response.json();
            processHistoricalData(data);

            // After processing, enable MQTT streaming
            mqttEnabled = true;
        } catch (error) {
            handleError("Error running query", error);
        }
    });

    // Process Historical Data
    function processHistoricalData(dataArray) {
        if (!Array.isArray(dataArray)) return;
        activeMeasurements.clear();
        dataArray.forEach(data => {
            if (data.measurement) { // Ensure measurement property exists
                activeMeasurements.add(data.measurement);
            }
        });
        
        console.log("Active Measurements @ historical data:", Array.from(activeMeasurements));
        // Sort by timestamp
        dataArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        dataArray.forEach(data => processChartData(data));

        updateChartVisuals();
    }

    // Delete Query
    deleteQueryButton.addEventListener("click", async () => {
        const selectedOption = queryList.querySelector("li.selected");
        if (!selectedOption) return alert("Please select a query to delete.");

        try {
            const response = await fetch(`/api/query/${selectedOption.dataset.value}`, { method: "DELETE" });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            alert("Query deleted successfully!");
            await fetchSavedQueries();
        } catch (error) {
            handleError("Error deleting query", error);
        }
    });

    // Process real-time MQTT Data (only after historical data loads)
    console.log("MQTT Enabled:", mqttEnabled);

    socket.on("mqtt_data", (payload) => {
        if (!mqttEnabled) return; 
        
        console.log("Active Measurements Set:", Array.from(activeMeasurements));

        payload.data.forEach(item => {
            // console.log("Checking MQTT Data:", item.topic, "in", Array.from(activeMeasurements));

            if (activeMeasurements.has(item.topic)) {  // Only process relevant measurements
                console.log(`✅ MATCH: Processing data for ${item.topic}`);

                processChartData({
                    measurement: item.topic,
                    timestamp: new Date(item.fields.timestamp || Date.now()), // Ensure timestamp
                    value: item.fields.value
                });
            }
        });

        updateChartVisuals();
    });

    // Reset Chart Data
    function resetChartData() {
        activeMeasurements.clear();;
        realTimeChart.data.datasets = [];
        realTimeChart.data.labels = [];

        realTimeChart.update({ duration: 0 });
        console.log("Chart reset complete.");
    }

    function processChartData(data) {
        console.log("Received data for processing:", data);

        if (!data.measurement || data.value === undefined || !data.timestamp) {
            console.error(" Invalid data format:", data);
            return;
        }

        let dataset = realTimeChart.data.datasets.find(d => d.label === data.measurement);
        if (!dataset) {
            dataset = {
                label: data.measurement,
                data: [],
                borderColor: getRandomColor(),
                fill: false,
                lineTension: 0.1,
                pointRadius: 2
            };
            realTimeChart.data.datasets.push(dataset);
        }

        const timestamp = new Date(data.timestamp);
        console.log("Processing data:", { measurement: data.measurement, x: timestamp, y: data.value });

        if (isNaN(timestamp.getTime())) {
            console.error(" Invalid timestamp:", data.timestamp);
            return;
        }

        const index = binarySearch(dataset.data, timestamp);
        if (index < 0) {
            dataset.data.splice(~index, 0, { x: timestamp, y: data.value });
            if (dataset.data.length > 200) dataset.data.splice(0, dataset.data.length - 200);
        }
    }

    function binarySearch(arr, timestamp) {
        let low = 0, high = arr.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            arr[mid].x < timestamp ? (low = mid + 1) : (high = mid);
        }
        return arr[low]?.x === timestamp ? low : ~low;
    }

    function updateChartVisuals() {
        realTimeChart.options.scales.x.time.unit = "minute";
        realTimeChart.update({ duration: 0, lazy: true, preservation: { x: ["userPan", "userZoom"] } });
    }

    function getRandomColor() {
        return `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    }

    function handleError(message, error) {
        console.error(`${message}:`, error);
        alert(message);
    }

    fetchSavedQueries();
});
