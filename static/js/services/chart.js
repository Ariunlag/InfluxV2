
export class ChartManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.charts = new Map(); // Individual charts
    this.combinedChart = null; // Combined chart
    this.initializeCombinedChart();
  }

  initializeCombinedChart() {
    const canvas = document.createElement('canvas');
    this.container.prepend(canvas);
    this.combinedChart = this.createChart(canvas);
  }


  createChart(canvas) {
    return new Chart(canvas, {
      type: 'line',
      data: { datasets: [] },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'MM-dd HH:mm:ss',
              displayFormats: {
                hour: 'HH:mm',
                minute: 'HH:mm:ss'
              }
            }
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Value'
            }
          }
        },
        plugins: {
          tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: false,
            callbacks: {
              title: function(tooltipItem) {
                // Use toLocaleString() to display local time
                return new Date(tooltipItem[0].raw.x).toLocaleString();
              },
              label: function(tooltipItem) {
                return `Value: ${tooltipItem.raw.y}`;
              }
            }
          }
        }
      }
    });
  }
  
  

  updateOrCreateChart(measurement, dataPoint) {
    // Handle individual chart
    if (!this.charts.has(measurement)) {
      this.createIndividualChart(measurement);
    }
    this.updateDataset(this.charts.get(measurement), measurement, dataPoint);
  
    // Update combined chart only if more than one measurement exists
    if (this.charts.size > 1) {
      this.updateDataset(this.combinedChart, measurement, dataPoint);
      this.combinedChart.canvas.style.display = 'block'; // Show the combined chart
    } else {
      // Hide the combined chart when only one measurement is present
      this.combinedChart.canvas.style.display = 'none';
    }
  }
  



  // updateOrCreateChart(measurement, dataPoint) {
  //   // Handle individual chart
  //   console.log('[Size of chart size]',this.charts.size);
  //   if (!this.charts.has(measurement)) {
  //     this.createIndividualChart(measurement);
  //   }
  //   this.updateDataset(this.charts.get(measurement), measurement, dataPoint);

  //   // Only show the combined chart if there are multiple measurements
  //   if (this.charts.size > 1) {
  //     this.updateDataset(this.combinedChart, measurement, dataPoint);
  //     this.combinedChart.canvas.style.display = 'block'; // Show the combined chart
  //   }
  // }

  createIndividualChart(measurement) {
    const canvas = document.createElement('canvas');
    this.container.appendChild(canvas);
    const chart = this.createChart(canvas);
    chart.data.datasets.push(this.createDataset(measurement));
    chart.update();
    this.charts.set(measurement, chart);
  }

  createDataset(measurement) {
    return {
      label: measurement,
      data: [],
      borderColor: this.getRandomColor(),
      borderWidth: 1,
      fill: false,
      lineTension: 0.1,
      pointRadius: 1.2
    };
  }

  updateDataset(chart, measurement, dataPoint) {
    console.log(`[char.js] Updating dataset for ${measurement} with:`, dataPoint);
    let dataset = chart.data.datasets.find(d => d.label === measurement);
    
    if (!dataset) {
      dataset = this.createDataset(measurement);
      chart.data.datasets.push(dataset);
    }

    const index = this.binarySearch(dataset.data, dataPoint.x);
    if (index < 0) {
      dataset.data.splice(~index, 0, dataPoint);
      if (dataset.data.length > 200) dataset.data.shift();
    }

    chart.update({ duration: 0 });
  }

  binarySearch(arr, timestamp) {
    let low = 0, high = arr.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      arr[mid].x < timestamp ? (low = mid + 1) : (high = mid);
    }
    return arr[low]?.x === timestamp ? low : ~low;
  }

  getRandomColor() {
    const getColorValue = () => Math.floor(Math.random() * 155) + 100;  // Ensures a value between 100 and 255
    return `rgb(${getColorValue()}, ${getColorValue()}, ${getColorValue()})`;
  }


  reset() {
    // Destroy all charts
    this.charts.forEach(chart => chart.destroy());
    this.combinedChart.destroy();
    
    // Clear container
    this.container.innerHTML = '';
    this.charts.clear();
    
    // Reinitialize combined chart
    this.initializeCombinedChart();
  }
}