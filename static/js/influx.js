import { ChartManager } from './services/chart.js';
console.log("Influx script loaded");

document.addEventListener("DOMContentLoaded", function () {
    const socket = io();
    const section_id = 'aggregate_query';

    // DOM elements
    const queryForm = document.getElementById("queryForm");
    const measurementSelect = document.getElementById("measurement");
    const timeRangeRadios = document.querySelectorAll('input[name="timeRange"]');
    const aggregationRadios = document.querySelectorAll('input[name="aggregation"]');

    const chartManager = new ChartManager("chart-container");

    // Fetch initial measurement data
    fetchData();

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

    function populateMeasurementDropdown(measurements) {
        measurementSelect.innerHTML = "";
        measurements.forEach((measurement) => {
            if (measurement !== 'user_queries') {
                const option = document.createElement("option");
                option.value = measurement;
                option.textContent = capitalize(measurement);
                measurementSelect.appendChild(option);
            }
        });
    }

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    queryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        

        if (!measurementSelect.value) {
            alert("Please select a measurement.");
            return;
        }

        const measurement = [measurementSelect.value];
        const timeRange = Array.from(timeRangeRadios).find((r) => r.checked)?.value || "last24Hours";
        const aggregation = Array.from(aggregationRadios).find((r) => r.checked)?.value || "average";

        chartManager.reset(); 

        try {
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ measurements: measurement, timeRange: timeRange, aggregation: aggregation, section_id: section_id })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            processBatchData(data);
        } catch (error) {
            console.error("Error submitting query:", error);
        }
    });

    function processBatchData(dataArray) {
        console.log("[aggrigated influx.js batchdata] Processing data:", dataArray);
        console.log("Type of dataArray:", typeof dataArray); // Add this line!

        dataArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        dataArray.forEach(data => {
            if (!data.measurement) return;

            const dataPoint = {
                x: new Date(data.timestamp),
                y: data.value
            };
            console.log('[aggrigated influx.js batchdata]', dataPoint);
            chartManager.updateOrCreateChart(data.measurement, dataPoint);
        });
    }

    socket.onAny((event, args) => {
        if (event.startsWith("dataUpdate_")) {
            const current_section_id = event.replace("dataUpdate_", "");
            if (current_section_id !== section_id) return;

            const dataArray = Array.isArray(args) ? args : [args];
            console.log("[aggrigated influx.js] Received event:", event, "with data:", dataArray ,'on socket');
            processBatchData(dataArray);
        }
    });
});
