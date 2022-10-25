import Chart from 'chart.js/auto';
import { DataUtils, Metric } from './data-utils'


const ctx = document.getElementById('myChart') 
const { metricname, childname, visualization, frame, uuid } = window.frameElement.dataset;
//const metric = window.frameElement.getAttribute("data-metric-name")

const pluginWindow = parent.document.getElementById(frame).contentWindow
const { logseq, t } = pluginWindow

logseq.UI.showMsg(`Loaded into iframe! uuid: ${uuid}, metricname: ${metricname}`)

async function main () { 

    console.log("inline main()")

    var metrics = await loadChildMetrics(metricname)
    var labels = []
    var values = []
    const keys = Object.keys(metrics)

    console.log(`keys: ${keys}`)

    keys.forEach((key) => {
        console.log(`push key: ${key}`)
        labels.push(key)
        var value = 0;

        metrics[key].forEach((metric) => {
            var num = Number.parseFloat(metric.value)
            if(!isNaN(num))
                value += num
        })
        
        values.push(value)
    }) 

    for(var i = 0; i < labels.length; i++) {
        console.log(`${labels[i]}: ${values[i]}`)
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: metricname,
                data: values
            }]
        }
    });
}


const DATA_PAGE = "metrics-plugin-data"

async function loadChildMetrics(metricName) {
    console.log(`loadChildMetrics ${metricName}`)
    var metrics = { };

    const tree = await logseq.Editor.getPageBlocksTree(DATA_PAGE)

    console.log(`Loaded tree ${tree}`)

    let blockId = await DataUtils.findBlock(tree, metricName)
    
    if(!blockId) return metrics;

    var block = await logseq.Editor.getBlock(blockId, { includeChildren: true })

    block?.children?.forEach( (child) => {
        try {
            // Only include child metrics
            JSON.parse(child.content)
        } catch {
            metrics[child.content] = []
            child.children.forEach((grandchild) => {
                const parsed = JSON.parse(grandchild.content)
                metrics[child.content].push(new Metric(parsed))
            })
        }
    })

    return metrics;
}

//logseq.ready(main).catch(console.error)
window.onload = function() {
    setTimeout(main, 200)
}