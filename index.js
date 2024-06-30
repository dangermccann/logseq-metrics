import '@logseq/libs'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-date-fns'
import { AddMetricUI, AddVizualizationUI } from './ui.js'
import { DataUtils, logger } from './data-utils'
import { mergeDeep, settingsDescription } from './settings'


var dataUtils
console = logger

logseq.useSettingsSchema(settingsDescription)


async function isDarkMode() {
    return (await logseq.App.getUserConfigs()).preferredThemeMode === 'dark'
}


function cssVars(names) {
    const style = getComputedStyle(top.document.documentElement)
    return names.map((name) => {return style.getPropertyValue(name)})
}


async function main() {
    const addMetricEl = document.getElementById('add-metric')
    if(!addMetricEl) {
        console.warn("Could not find main div")
        return
    }

    const addVisualizationEl = document.getElementById('visualize-metrics')

    dataUtils = new DataUtils(logseq)

    if(await isDarkMode())
        document.body.classList.add("dark")

    const addMetricUI = new AddMetricUI(Visualization.instances)
    addMetricUI.setUpUIHandlers()

    const addVizualizationUI = new AddVizualizationUI()
    addVizualizationUI.setUpUIHandlers()

    logseq.Editor.registerSlashCommand("Metrics → Add", async () => {
        await logseq.Editor.insertAtEditingCursor("CHANGED (since v0.13): Use command palette to add new metric: ⌘+⇧+P or Ctrl+Shift+P")
    })

    logseq.App.registerCommandPalette({
        key: "metrics-add",
        label: "Metrics → Add",
    }, async (e) => {
        addVizualizationUI.hide()
        addMetricUI.show()
        addMetricUI.clear()

        logseq.showMainUI({ autoFocus: true })
        setTimeout(() => {
            addMetricEl.style.left = "50%"
            addMetricEl.style.top = "50%"
            addMetricUI.focus()    
        }, 200)
    })

    logseq.Editor.registerSlashCommand("Metrics → Visualize", async () => {
        addMetricUI.hide()
        addVizualizationUI.show()
        addVizualizationUI.clear()

        logseq.showMainUI({ autoFocus: true })
        setTimeout(() => {
            addVisualizationEl.style.left = "50%"
            addVisualizationEl.style.top = "50%"
            addVizualizationUI.focus()    
        }, 200)
    })

    logseq.Editor.registerSlashCommand("Metrics → Properties Line Chart", async () => { 
        const content = '{{renderer :metrics, :property1 :property2, TITLE (use "-" to leave empty), properties-line}}'

        const block = await logseq.Editor.getCurrentBlock()
        if(block) {
            await logseq.Editor.updateBlock(block.uuid, content)
            await logseq.Editor.exitEditingMode()
            setTimeout(() => {
                logseq.Editor.editBlock(block.uuid, { pos: 21 })
            }, 50)
        }
    })

    logseq.Editor.registerSlashCommand("Metrics → Properties Bar Chart", async () => { 
        const content = '{{renderer :metrics, :property1 :property2, TITLE (use "-" to leave empty), properties-bar, sum}}'

        const block = await logseq.Editor.getCurrentBlock()
        if(block) {
            await logseq.Editor.updateBlock(block.uuid, content)
            await logseq.Editor.exitEditingMode()
            setTimeout(() => {
                logseq.Editor.editBlock(block.uuid, { pos: 21 })
            }, 50)
        }
    })

    logseq.provideModel({
        async editBlock(e) {
          const { uuid } = e.dataset
          await logseq.Editor.editBlock(uuid)
        }
    })

    logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
        const uuid = payload.uuid
        const [type, metric, childMetric, visualization] = payload.arguments

        const otherArgs = payload.arguments.slice(4)

        if(type !== ":metrics")
            return

        let viz = Visualization.getInstanceFor(uuid, slot)
        if(viz) {
            await viz.postRender()
            return
        }

        viz = Visualization.create(uuid, slot, metric, childMetric, visualization, otherArgs)
        if(!viz) {
            console.log(`Unknown visualization: ${visualization}`)
            return
        }

        console.debug(`visualize ${visualization} @${slot}`)

        const html = await viz.render()
        logseq.provideUI({
            key: `metrics-${slot}`,
            slot: slot,
            template: html,
            reset: true,
            style: { flex: 1}
        })
        await viz.postRender()
    })

    const changeColorsHook = async (data) => {
        for (const blockInstances of Object.values(Visualization.instances))
            for (const viz of Object.values(blockInstances))
                await viz.postRender()

        if(data.mode === "dark")
            document.body.classList.add("dark")
        else 
            document.body.classList.remove("dark")
    }

    logseq.App.onThemeChanged(changeColorsHook)
    logseq.App.onThemeModeChanged(changeColorsHook)

    logseq.App.onRouteChanged((path, template) => {
        Visualization.releaseAll()
    })

    logseq.provideStyle(`
        :root {
            --metrics-bg-color1: var(--ls-primary-background-color);
            --metrics-bg-color2: var(--ls-secondary-background-color);
            --metrics-border-color: var(--ls-border-color);
            --metrics-text-color: var(--ls-primary-text-color);

            --metrics-color1: #0f9bd7;
            --metrics-color2: #30b5a6;
            --metrics-color3: #e6c700;
            --metrics-color4: #e66f00;
            --metrics-color5: #e2036b;
            --metrics-color6: #8639ac;
            --metrics-color7: #727274;

            // Reserved for future use
            // Nice idea, but not all themes adapt highlight vars (it is fresh feature)
            // --metrics-color1: var(--ls-highlight-color-blue);
            // --metrics-color2: var(--ls-highlight-color-green);
            // --metrics-color3: var(--ls-highlight-color-yellow);
            // --metrics-color4: var(--ls-highlight-color-red);
            // --metrics-color5: var(--ls-highlight-color-pink);
            // --metrics-color6: var(--ls-highlight-color-purple);
            // --metrics-color7: var(--ls-highlight-color-gray);
        }

        .metrics-card {
            width: 11.4rem;
            height: 9.4rem;
            color: var(--metrics-text-color);
            border-color: var(--metrics-border-color);
            background-color: var(--metrics-bg-color1);
        }
        .metrics-card > div:nth-child(1) {
            background-color: var(--metrics-bg-color2);
        }
        .metrics-card > div:nth-child(2) {
            margin: auto;
        }

        .metrics-chart {
            width: 100%;
            height: ${logseq.settings.chart_height}px;
            margin: 0 0 1em 0;
            border-color: var(--metrics-border-color);
            background-color: var(--metrics-bg-color1);
        }
    `)

    console.log("Loaded")
}


function splitBy(text, delimeters=" |:") {
    text = text || ""
    if(!text)
        return []

    let chars = `[${delimeters}]+`
    text = text.replace(new RegExp("^" + chars), "")
    text = text.replace(new RegExp(chars + "$"), "")
    return text.split(new RegExp(chars))
}


class Visualization {
    static instances = {}

    static releaseAll() {
        for (const [ uuid, blockInstances ] of Object.entries(Visualization.instances)) {
            for (const viz of Object.values(blockInstances))
                viz.release()

            delete Visualization.instances[uuid]
        }
    }

    static create(uuid, slot, name, childName, visualization, args) {
        let instance = Visualization.getInstanceFor(uuid, slot)
        if(instance)
            return instance

        name = name.trim()
        childName = childName.trim()
        childName = childName === "-" ? "" : childName
        visualization = visualization.trim()

        const types = [
            [CardVisualization, ["sum", "average", "latest", "count"]],
            [PropertiesCardVisualization, ["properties-sum", "properties-average", "properties-latest", "properties-count"]],
            [BarChartVisualization, ["bar"]],
            [PropertiesBarChartVisualization, ["properties-bar"]],
            [MetricsLineChartVisualization, ["line", "cumulative-line"]],
            [PropertiesLineChartVisualization, ["properties-line", "properties-cumulative-line"]],
        ]

        for (const [ cls, allowed ] of types) {
            if(allowed.includes(visualization)) {
                instance = new cls(uuid, slot, name, childName, visualization, args)
                Visualization.setInstanceFor(uuid, slot, instance)
                return instance
            }
        }

        return null
    }

    static getInstanceFor(uuid, slot) {
        const blockInstances = Visualization.instances[uuid]
        if(!blockInstances)
            return null
        return blockInstances[slot] || null
    }

    static setInstanceFor(uuid, slot, instance) {
        Visualization.instances[uuid] = Visualization.instances[uuid] || {}
        const old = Visualization.instances[uuid][slot]
        if(old)
            old.release()
        Visualization.instances[uuid][slot] = instance
    }

    constructor(uuid, slot, metric, childMetric, type, args) {
        if (this.constructor === Visualization)
            throw new Error("Abstract class")

        this.uuid = uuid
        this.slot = slot
        this.metric = metric
        this.childMetric = childMetric
        this.type = type
        this.args = args
    }

    release() {}

    async render() {
        throw new Error("Should be implemented in child class")
    }

    async postRender() {}
}

class _CardVisualization extends Visualization {
    async loadData() {
        throw new Error("Should be implemented in child class")
    }

    getTitle() {
        throw new Error("Should be implemented in child class")
    }

    async render() {
        const metrics = await this.loadData()

        const shortType = this.type.indexOf("-") > -1 ? this.type.split('-')[1] : this.type
        const [ title, calcFunc ] = {
            sum: ["Total", this.sum],
            average: ["Average", this.average],
            latest: ["Latest", this.latest],
            count: ["Count", this.count],
        }[shortType]

        let name = this.getTitle()

        const value = calcFunc.bind(this)(metrics)

        return `
            <div class="metrics-card flex flex-col text-center border"
                 data-uuid="${this.uuid}"
                 data-on-click="editBlock"
                >
                <div class="w-full text-lg p-2">${title} ${name}</div>
                <div class="w-full text-4xl"><span>${value ? value : "—"}</span></div>
            </div>
        `.trim()
    }

    sum(metrics) {
        let sum = 0
        metrics.forEach((metric) => {
            const num = Number.parseFloat(metric.value)
            if(!isNaN(num))
                sum += num
        })
        return sum
    }

    average(metrics) {
        if(metrics.length === 0) return 0

        return (this.sum(metrics) / metrics.length).toFixed(2)
    }
    
    latest(metrics) {
        if(metrics.length === 0) return null

        return dataUtils.sortMetricsByDate(metrics).slice(-1)[0].value
    }

    count(metrics) {
        return metrics.length
    }
}


class PropertiesCardVisualization extends _CardVisualization {
    async loadData() {
        let start = this.args.length > 0 ? this.args[0] : '0000-01-01';
        let end   = this.args.length > 1 ? this.args[1] : '9999-12-31';

        start = dataUtils.interpretUserDate(start)
        end = dataUtils.interpretUserDate(end)

        start = start.split('-').join('')
        end = end.split('-').join('')

        const metricsList = await dataUtils.propertiesQuery([splitBy(this.metric)], start, end)
        return metricsList[0]
    }

    getTitle() {
        return this.childMetric
    }
}

class CardVisualization extends _CardVisualization {
    async loadData() {
        return dataUtils.loadMetrics(this.metric, this.childMetric)
    }

    getTitle() {
        let name = this.metric
        if(this.childMetric)
            name += " / " + this.childMetric
        name = name.replaceAll("-", " ").replaceAll(" ", "&nbsp;")
        return name
    }
}

class _ChartVisualization extends Visualization {
    chartType = null

    constructor(uuid, slot, metric, childMetric, type, args) {
        super(uuid, slot, metric, childMetric, type, args)

        if (this.constructor === _ChartVisualization)
            throw new Error("Abstract class")

        this.chart = null
    }

    release() {
        if(!this.chart)
            return

        this.chart.destroy()
        this.chart = null
    }

    async render() {
        let showDownload = logseq.settings.show_csv_download
        if(this.chartType == "bar")
            showDownload = false

        return `
            <div class="metrics-chart flex flex-col border"
                 data-uuid="${this.uuid}"
                 data-on-click="editBlock"
                >
                <canvas id="chart_${this.slot}"></canvas>
                <button id="chart_${this.slot}_download" style="display: ${showDownload ? 'block' : 'none'}">Download Chart Data as CSV</button>
            </div>
        `.trim()
    } 

    async postRender() {
        const slotContainer = top.document.getElementById(this.slot)
        if(!slotContainer){
            console.debug(`Slot doesn't exist: ${this.slot}`)
            return null
        }
        this.release()

        slotContainer.style.width = "100%"

        this.chart = await this.getChart()

        // callback for CSV download
        top.document.getElementById(`chart_${this.slot}_download`).addEventListener("click", () => {
            console.log("Export to CSV triggered.")
            this.downloadCSV({
                filename: "chart-data.csv",
            })
        });

        return this.chart
    }

    getChartColors() {
        return cssVars([
            "--metrics-color1",
            "--metrics-color2",
            "--metrics-color3",
            "--metrics-color4",
            "--metrics-color5",
            "--metrics-color6",
            "--metrics-color7",
        ])
    }

    async getChartOptions() {
        const [ textColor, borderColor ] = cssVars([
            "--metrics-text-color",
            "--metrics-border-color",
        ])

        return {
            maintainAspectRatio: false,
            responsive: true,
            animation: true,
            layout: {
                padding: 10
            },
            scales: {
                x: {
                    grid: {
                        tickColor: borderColor,
                        color: borderColor,
                        borderColor: borderColor,
                        drawBorder: false,
                        drawTicks: false,
                        display: false
                    },
                    ticks: {
                        color: textColor,
                        padding: 10,
                        backdropPadding: 10
                    },
                    time: {}
                },
                y: {
                    type: "linear",
                    position: "left",
                    grid: {
                        tickColor: borderColor,
                        color: borderColor,
                        borderColor: borderColor,
                        drawBorder: true,
                        drawTicks: false,
                        display: true
                    },
                    ticks: {
                        color: textColor,
                        padding: 10,
                        backdropPadding: 10,
                    }
                },
            },
            plugins: {
                title: {
                    display: true,
                    color: textColor
                },
                legend: {
                    display: false,
                    labels: {
                        color: textColor
                    }
                }
            }
        }
    }

    async getData(options) {
        throw new Error("Should be implemented in child class")
    }

    async getChart() {
        const options = await this.getChartOptions()
        const params = {
            data: await this.getData(options),
            options: options,
        }

        if(this.chartType)
            params.type = this.chartType

        return this._createChart(params)
    }

    _createChart(params) {
        const id = `chart_${this.slot}`
        const canvas = top.document.getElementById(id)
        if(!canvas) {
            console.debug(`Canvas doesn't exist: ${id}`)
            return null
        }

        return new Chart(canvas, params)
    }

    // https://stackoverflow.com/a/75212386
    _convertChartDataToCSV(args) {
        let result, columnDelimiter, lineDelimiter, data, label;

        label = args.data.label;

        data = args.data.data || null;
        if (data == null || !data.length) {
            console.error("No data")
            return null;
        }

        columnDelimiter = args.columnDelimiter || ',';
        lineDelimiter = args.lineDelimiter || '\n';

        // header
        result = 'Date/Time' + columnDelimiter + label + columnDelimiter + lineDelimiter;

        // data
        for (let i = 0; i < data.length; i++) {
            let date = new Date(data[i].x).toISOString().replace("T", " ").replace("Z", "");
            result += date + columnDelimiter + data[i].y + columnDelimiter + lineDelimiter;
        }

        return result;
    }

    // https://stackoverflow.com/a/75212386
    downloadCSV(args) {
        var data, filename, link;
        var csv = "";

        var chart = this.chart;

        for (var i = 0; i < chart.data.datasets.length; i++) {
            csv += this._convertChartDataToCSV({
                data: chart.data.datasets[i],
            });
        }

        if (csv === null) return;

        filename = args.filename || 'chart-data.csv';
        if (!csv.match(/^data:text\/csv/i)) {
            csv = 'data:text/csv;charset=utf-8,' + csv;
        }

        // not sure if anything below this comment works
        data = encodeURI(csv);
        link = document.createElement('a');
        link.setAttribute('href', data);
        link.setAttribute('download', filename);
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);
    } 
}


class _BarChartVisualization extends _ChartVisualization {
    chartType = "bar"

    async loadData(options) {
        throw new Error("Should be implemented in child class")
    }

    async getData(options) {
        var metrics = await this.loadData(options)
        var labels = []
        var values = []

        Object.keys(metrics).forEach((key) => {
            labels.push(key)
            var value = 0

            metrics[key].forEach((metric) => {
                var num = Number.parseFloat(metric.value)
                if(!isNaN(num))
                    value += num
            })

            values.push(value)
        })

        return {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: this.getChartColors()
            }]
        }
    }
}

class BarChartVisualization extends _BarChartVisualization { 
    chartType = "bar"

    async loadData(options) {
        return await dataUtils.loadChildMetrics(this.metric)
    }
}

class PropertiesBarChartVisualization extends _BarChartVisualization { 
    chartType = "bar"

    async getChartOptions() {
        const config = await logseq.App.getUserConfigs()
        const title = this.childMetric

        const options = {
            scales: {
                x: {
                    time: {
                        tooltipFormat: config.preferredDateFormat
                    }
                }
            },
            plugins: {
                title: {
                    display: !!title,
                    text: title
                }
            }
        }

        return mergeDeep(await super.getChartOptions(), options)
    }

    async loadData(options) {
        const properties = splitBy(this.metric)
        let mode = this.args.length > 0 ? this.args[0] : "sum"
        let bucketSize = this.args.length > 1 ? this.args[1] : 1
        let start = this.args.length > 2 ? this.args[2] : '0000-01-01';
        let end   = this.args.length > 3 ? this.args[3] : '9999-12-31';

        start = dataUtils.interpretUserDate(start)
        end = dataUtils.interpretUserDate(end)

        start = start.split('-').join('')
        end = end.split('-').join('')

        const datasets = await dataUtils.propertiesQueryBarChart(
            properties, bucketSize, start, end
        )

        var results = []

        datasets.forEach((dataset, idx) =>  {
            var result =  {}
            Object.keys(dataset).forEach((key) => {
                let value = 0
                if(mode == "average")
                    value = dataset[key].average
                else 
                    value = dataset[key].sum
    
                result[(new Date(dataset[key].bucketTime).toLocaleDateString())] = value
            })
            results.push({
                label: properties[idx],
                data: result
            })
        })

        return results
    }

    async getData(options) {
        const datasets = await this.loadData(options)

        const colors = this.getChartColors()
        datasets.forEach((dataset, idx) => {
            dataset.backgroundColor = dataset.borderColor = colors[idx % colors.length]
        })

        if(datasets.length > 1)
            options.plugins.legend.display = true

        return {
            datasets: datasets
        }
    }
}

class _LineChartVisualization extends _ChartVisualization {
    chartType = "line"

    async getChartOptions() {
        const options = {
            elements: {
                line: {
                    tension: 0.1
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: "day"
                    }
                }
            }
        }

        return mergeDeep(await super.getChartOptions(), options)
    }

    async loadData(options) {
        throw new Error("Should be implemented in child class")
    }

    async getData(options) {
        const datasets = await this.loadData(options)

        const colors = this.getChartColors()
        datasets.forEach((dataset, idx) => {
            dataset.backgroundColor = dataset.borderColor = colors[idx % colors.length]
        })

        if(datasets.length > 1)
            options.plugins.legend.display = true

        return {
            datasets: datasets
        }
    }
}


class MetricsLineChartVisualization extends _LineChartVisualization {
    async getChartOptions() {
        const options = {
            plugins: {
                title: {
                    text: this.metric
                }
            }
        }

        return mergeDeep(super.getChartOptions(), options)
    }

    async loadData(options) {
        const cumulativeMode = this.type.includes("cumulative-")
        return await dataUtils.loadLineChart(this.metric, cumulativeMode)
    }
}


class PropertiesLineChartVisualization extends _LineChartVisualization {
    altAxisSuffix = "*"

    async getChartOptions() {
        const config = await logseq.App.getUserConfigs()
        const title = this.childMetric

        const options = {
            scales: {
                x: {
                    time: {
                        tooltipFormat: config.preferredDateFormat
                    }
                }
            },
            plugins: {
                title: {
                    display: !!title,
                    text: title
                }
            }
        }

        return mergeDeep(await super.getChartOptions(), options)
    }

    async loadData(options) {
        const properties = splitBy(this.metric)
        const cumulativeMode = this.type.includes("cumulative-")
        const needAltAxis = p => p.endsWith(this.altAxisSuffix)
        let start = this.args.length > 0 ? this.args[0] : '0000-01-01';
        let end   = this.args.length > 1 ? this.args[1] : '9999-12-31';

        start = dataUtils.interpretUserDate(start)
        end = dataUtils.interpretUserDate(end)

        start = start.split('-').join('')
        end = end.split('-').join('')

        const datasets = await dataUtils.propertiesQueryLineChart(
            properties.map(p => p.replace(new RegExp("\\" + this.altAxisSuffix + "$"), "")),
            cumulativeMode, start, end
        )

        datasets.forEach((dataset, idx) => {
            if (needAltAxis(properties[idx])) {
                dataset.label = properties[idx]
                dataset.yAxisID = "y2"
            }
        })

        if(properties.some(needAltAxis)) {
            options.scales.y.grid.drawTicks = true
            options.scales.y2 = {}
            mergeDeep(options.scales.y2, options.scales.y)
            options.scales.y2.position = "right"
        }
        if(properties.every(needAltAxis))
            delete options.scales.y

        return datasets
    }
}


logseq.ready().then(main).catch(console.error)
