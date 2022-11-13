import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { DataUtils, Metric } from './data-utils'
import { Settings, ColorSettings, defaultSettings } from './settings'


const ctx = document.getElementById('myChart') 
const { metricname, childname, visualization, frame, uuid } = window.frameElement.dataset;
const pluginWindow = parent.document.getElementById(frame).contentWindow
const { logseq, t } = pluginWindow
const dataUtils = new DataUtils(logseq)
var chart;

const settings = Object.assign({}, defaultSettings, logseq.settings)
const themeMode = (await logseq.App.getUserConfigs()).preferredThemeMode;
const colors = themeMode === "dark" ? settings.dark : settings.light

ctx.style.backgroundColor = colors.bg_color_1;

const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: false,
    layout: {
        padding: 10
    },
    scales: {
        xAxis: {
            grid: {
                tickColor: colors.border_color,
                color: colors.border_color,
                borderColor: colors.border_color,
                drawBorder: false,
                drawTicks: false,
                display: false
            },
            ticks: {
                color: colors.text_color,
                padding: 10,
                backdropPadding: 10
            }
        },
        yAxis: {
            grid: {
                tickColor: colors.border_color,
                color: colors.border_color,
                borderColor: colors.border_color,
                drawBorder: true,
                drawTicks: false,
                display: true
            },
            ticks: {
                color: colors.text_color,
                padding: 10,
                backdropPadding: 10
            }
        }
    },
    plugins: {
        title: {
            display: true,
            text: metricname,
            color: colors.text_color
        },
        legend: {
            display: false,
            labels: {
                color: colors.text_color
            }
        }
    }
};

async function main () { 
    console.log("inline main()")
    if(visualization === 'bar')
        bar()
    else if(visualization === 'line')
        line('standard')
    else if(visualization === 'cumulative-line')
        line('cumulative')
    else
        console.log(`Invalid visualization: ${visualization}`)
}

async function line(mode) { 
    let colorAry = [ colors.color_1, colors.color_2, colors.color_3, colors.color_4, colors.color_5 ]

    let datasets = await dataUtils.loadLineChart(metricname, mode)
    datasets.forEach((dataset, idx) => {
        dataset.backgroundColor = colorAry[idx % colorAry.length];
        dataset.borderColor = colorAry[idx % colorAry.length];
    })

    chartOptions.scales.xAxis.type = 'time';
    chartOptions.scales.xAxis.time = {
        unit: 'day'
    }
    chartOptions.elements = {
        line: {
            tension: 0.1
        }
    }

    if(datasets.length > 1)
        chartOptions.plugins.legend.display = true


    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: chartOptions
    })
}

async function bar() { 
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
                data: values,
                backgroundColor: [
                    colors.color_1,
                    colors.color_2,
                    colors.color_3,
                    colors.color_4,
                    colors.color_5
                ]
            }]
        },
        options: chartOptions
    });
}

//window.onload = main
console.log("inline loaded...")
main()