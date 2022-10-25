import Chart from 'chart.js/auto';
import { DataUtils, Metric } from './data-utils'


const ctx = document.getElementById('myChart') 
const { metricname, childname, visualization, frame, uuid } = window.frameElement.dataset;
const pluginWindow = parent.document.getElementById(frame).contentWindow
const { logseq, t } = pluginWindow
const dataUtils = new DataUtils(logseq)
var chart;

async function main () { 
    console.log("inline main()")

    var metrics = await dataUtils.loadChildMetrics(metricname)
    var labels = []
    var values = []
    const keys = Object.keys(metrics)

    keys.forEach((key) => {
        labels.push(key)
        var value = 0;

        metrics[key].forEach((metric) => {
            var num = Number.parseFloat(metric.value)
            if(!isNaN(num))
                value += num
        })

        values.push(value)
    }) 

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: metricname,
                data: values,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)'
                ]
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true
        }
    });
}

window.onload = main