import '@logseq/libs'
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { DataUtils, Metric, logger } from './data-utils'
import { defaultSettings, mergeDeep } from './settings'


var dataUtils
console = logger


async function isDarkMode() {
    return (await logseq.App.getUserConfigs()).preferredThemeMode === 'dark'
}


function cssVars(names) {
    const style = getComputedStyle(top.document.documentElement)
    return names.map((name) => {return style.getPropertyValue(name)})
}


async function refreshBlock(uuid) {
    const block = await logseq.Editor.getBlock(uuid)
    if(!block || !block.content)
        return

    await logseq.Editor.updateBlock(uuid, "")
    await logseq.Editor.updateBlock(uuid, block.content)
    console.debug(`Refreshed block: ${uuid}`)
}


async function main() {
    const addMetricEl = document.getElementById('add-metric')
    if(!addMetricEl) {
        console.warn("Could not find main div")
        return;
    }

    const addVisualizationEl = document.getElementById('visualize-metrics')

    dataUtils = new DataUtils(logseq)

    if(await isDarkMode())
        document.body.classList.add("dark")

    // load settings, merge with defaults and save back so they can be modified by user
    logseq.updateSettings(mergeDeep({...defaultSettings}, logseq.settings))

    // prepare UI for adding metrics
    const addMetricUI = new AddMetricUI();
    addMetricUI.setUpUIHandlers();

    const addVizualizationUI = new AddVizualizationUI();
    addVizualizationUI.setUpUIHandlers();

    logseq.Editor.registerSlashCommand("Metrics → Add", async () => {
        await logseq.Editor.insertAtEditingCursor("CHANGED: Use command palette to add new metric: ⌘+⇧+P or Ctrl+Shift+P");
    })

    logseq.App.registerCommandPalette({
        key: 'metrics-add',
        label: 'Metrics → Add',
    }, async (e) => {
        addVizualizationUI.hide()
        addMetricUI.show()
        addMetricUI.clear()

        logseq.showMainUI({ autoFocus: true })
        setTimeout(() => {
            addMetricEl.style.left = "50%"
            addMetricEl.style.top = "50%"
            addMetricUI.focus()    
        }, 200);
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
        }, 200);
        
    })

    logseq.Editor.registerSlashCommand("Metrics → Properties Chart", async () => { 
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

    logseq.provideModel({
        async editBlock(e) {
          const { uuid } = e.dataset
          await logseq.Editor.editBlock(uuid)
        }
    })

    logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
        const uuid = payload.uuid
        const [type, metric, childMetric, visualization] = payload.arguments

        if(type !== ":metrics")
            return

        let viz = Visualization.getInstanceFor(uuid, slot)
        if(viz) {
            await viz.postRender()
            return
        }

        viz = Visualization.create(uuid, slot, metric, childMetric, visualization)
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
          height: 11rem;
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
            margin: 0;
            border-color: var(--metrics-border-color);
            background-color: var(--metrics-bg-color1);
        }
    `)

    console.log("Loaded")
}


function splitBy(text, delimeters=' |:') {
    text = text || ""
    if(!text)
        return []

    let chars = `[${delimeters}]+`
    text = text.replace(new RegExp('^' + chars), '')
    text = text.replace(new RegExp(chars + '$'), '')
    return text.split(new RegExp(chars))
}


class Visualization {
    static instances = {}

    static releaseAll() {
        for (const blockInstances of Object.values(Visualization.instances))
            for (const viz of Object.values(blockInstances))
                viz.release()
        Visualization.instances = {}
    }

    static create(uuid, slot, name, childName, visualization) {
        let instance = Visualization.getInstanceFor(uuid, slot)
        if(instance)
            return instance

        name = name.trim()
        childName = childName.trim()
        childName = childName === '-' ? '' : childName 
        visualization = visualization.trim()

        const types = [
            [CardVisualization, ['sum', 'average', 'latest']],
            [ChartVisualization, [
                'line', 'cumulative-line', 'bar',
                'properties-line', 'properties-cumulative-line',
            ]]
        ]
        for (const [ cls, allowed ] of types) {
            if(allowed.includes(visualization)) {
                instance = new cls(uuid, slot, name, childName, visualization)
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

    constructor(uuid, slot, metric, childMetric, type) {
        if (this.constructor === Visualization)
            throw new Error('Abstract class')

        this.uuid = uuid
        this.slot = slot
        this.metric = metric
        this.childMetric = childMetric
        this.type = type
    }

    release() {}

    async render() {
        throw new Error("Should be implemented in child class")
    }

    async postRender() {}
}


class CardVisualization extends Visualization {
    async render() {
        const metrics = await dataUtils.loadMetrics(this.metric, this.childMetric)

        console.log(`Loaded ${metrics.length} metrics.`)

        const [ title, calcFunc ] = {
            sum: ["Total", this.sum],
            average: ["Average", this.average],
            latest: ["Latest", this.latest],
        }[this.type]

        const label = `${title} ${this.metric}${this.childMetric ? " / " + this.childMetric : ""}`
        const value = calcFunc.bind(this)(metrics)

        return `
            <div class="metrics-card w-48 flex flex-col text-center border"
                 data-uuid="${this.uuid}"
                 data-on-click="editBlock"
                >
                <div class="w-full text-lg p-2">${label}</div>
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
}


class ChartVisualization extends Visualization {
    constructor(uuid, slot, metric, childMetric, type) {
        super(uuid, slot, metric, childMetric, type)

        this.chart = null
    }

    release() {
        if(!this.chart)
            return

        this.chart.destroy()
        this.chart = null
    }

    async render() {
        return `
            <div class="metrics-chart flex flex-col border"
                 data-uuid="${this.uuid}"
                 data-on-click="editBlock"
                >
                <canvas id="chart_${this.slot}"></canvas>
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

        if(this.type === 'bar')
            this.chart = await this.bar()
        else if(this.type === 'line')
            this.chart = await this.line('metric', 'standard')
        else if(this.type === 'cumulative-line')
            this.chart = await this.line('metric', 'cumulative')
        else if(this.type === 'properties-line')
            this.chart = await this.line('properties', 'standard')
        else if(this.type === 'properties-cumulative-line')
            this.chart = await this.line('properties', 'cumulative')

        return this.chart
    }

    getChartColors() {
        return cssVars([
            '--metrics-color1',
            '--metrics-color2',
            '--metrics-color3',
            '--metrics-color4',
            '--metrics-color5',
            '--metrics-color6',
            '--metrics-color7',
        ])
    }

    getChartOptions() {
        const [ textColor, borderColor ] = cssVars([
            '--metrics-text-color',
            '--metrics-border-color',
        ])

        return {
            maintainAspectRatio: false,
            responsive: true,
            animation: true,
            layout: {
                padding: 10
            },
            scales: {
                xAxis: {
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
                yAxis: {
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
                        backdropPadding: 10
                    }
                }
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

    async line(type, mode) {
        const chartOptions = this.getChartOptions()
        let datasets = []

        if(type === 'metric') {
            chartOptions.plugins.title.text = this.metric;
            datasets = await dataUtils.loadLineChart(this.metric, mode);
        }
        else if(type === 'properties') {
            let config = await logseq.App.getUserConfigs();
            chartOptions.scales.xAxis.time.tooltipFormat = config.preferredDateFormat;

            chartOptions.plugins.title.text = (this.childMetric === '-' ? '' : this.childMetric);
            datasets = await dataUtils.propertiesQueryLineChart(splitBy(this.metric), mode);
        }

        const colors = this.getChartColors()
        datasets.forEach((dataset, idx) => {
            dataset.backgroundColor = dataset.borderColor = colors[idx % colors.length]
        })

        chartOptions.scales.xAxis.type = 'time';
        chartOptions.scales.xAxis.time.unit = 'day';
        chartOptions.elements = {
            line: {
                tension: 0.1
            }
        }

        if(datasets.length > 1)
            chartOptions.plugins.legend.display = true

        const params = {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: chartOptions
        }

        return this._createChart(params)
    }

    async bar() {
        const chartOptions = this.getChartOptions()

        var metrics = await dataUtils.loadChildMetrics(this.metric)
        var labels = []
        var values = []

        Object.keys(metrics).forEach((key) => {
            labels.push(key)
            var value = 0;

            metrics[key].forEach((metric) => {
                var num = Number.parseFloat(metric.value)
                if(!isNaN(num))
                    value += num
            })

            values.push(value)
        })

        const params = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: this.getChartColors()
                }]
            },
            options: chartOptions
        }

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
}


class AddMetricUI {
    root;
    metricNameInput;
    childMetricInput;
    dateInput;
    timeInput;
    valueInput;
    autoComplete;
    childAutoComplete;
    autoCompleteData;

    constructor() {
        this.root = document.getElementById("add-metric")
        this.metricNameInput = document.getElementById("metric-name-input");
        this.childMetricInput = document.getElementById("child-metric-input");
        this.dateInput = document.getElementById("date-input");
        this.timeInput = document.getElementById("time-input");
        this.valueInput = document.getElementById("value-input");
        this.autoComplete = document.getElementById("metric-name-auto-complete");
        this.childAutoComplete = document.getElementById("child-metric-auto-complete");
    
        this.autoCompleteData = [ ]
    }

    setUpUIHandlers() {
        const _this = this;
        document.addEventListener('keydown', function (e) {
            //console.log(e.key)
            if (e.keyCode === 27) {
              logseq.hideMainUI({ restoreEditingCursor: true })
            }
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-close-x")?.addEventListener('click', function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-close-button")?.addEventListener('click', function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-enter-button")?.addEventListener('click', async function (e) {
            if(_this.validate()) {
                // add to metrics data page
                await dataUtils.enterMetric(_this.metricNameInput.value, _this.childMetricInput.value, 
                    _this.formatMetric())

                // add to journal if checked
                if(document.getElementById('journal-check').checked) {
                    console.log("Will add to journal")
                    await dataUtils.addToJournal(_this.metricNameInput.value, _this.childMetricInput.value, 
                        JSON.parse(_this.formatMetric()))
                }

                logseq.hideMainUI({ restoreEditingCursor: true })

                for (const blockInstances of Object.values(Visualization.instances))
                    for(const viz of Object.values(blockInstances))
                        if(viz.metric === _this.metricNameInput.value)
                            await refreshBlock(viz.uuid)
            }
            else 
                console.log("Validation failed")
            
            e.stopPropagation()
        }, false)

        // Auto complete events
        this.autoComplete.addEventListener('mousedown', function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute('data-id'))
                return;

            _this.metricNameInput.value = e.target.textContent
            _this.autoComplete.classList.add('hidden')
        }, true)

        this.metricNameInput.addEventListener('focus', function(e) { 
            _this.prepareAutoComplete(null)
        })

        this.metricNameInput.addEventListener('blur', function(e) { 
            _this.autoComplete.classList.add('hidden') 
        })

        this.metricNameInput.addEventListener('keyup', function(e) { 
            AutoComplete.doAutoComplete(e, _this.autoComplete, _this.autoCompleteData)
        })

        // Child auto complete 
        this.childAutoComplete.addEventListener('mousedown', function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute('data-id'))
                return;

            _this.childMetricInput.value = e.target.textContent
            _this.childAutoComplete.classList.add('hidden')
        }, true)

        this.childMetricInput.addEventListener('focus', function(e) { 
            _this.prepareAutoComplete(_this.metricNameInput.value)
        })

        this.childMetricInput.addEventListener('blur', function(e) { 
            _this.childAutoComplete.classList.add('hidden') 
        })

        this.childMetricInput.addEventListener('keyup', function(e) { 
            AutoComplete.doAutoComplete(e, _this.childAutoComplete, _this.autoCompleteData)
        })
    }

    async prepareAutoComplete(parent) {
        this.autoCompleteData = await dataUtils.loadMetricNames(parent)
    }

    formatMetric() {
        const date = new Date(`${this.dateInput.value} ${this.timeInput.value}`)
        const val = { date: date, value: this.valueInput.value }
        return JSON.stringify(val)
    }

    clear() {
        this.metricNameInput.value = '';
        this.childMetricInput.value = '';
        this.valueInput.value = '';

        document.getElementById('journal-check').checked = logseq.settings.add_to_journal || false

        let now = new Date();
        this.dateInput.value = now.toLocaleDateString('en-CA')
        this.timeInput.value = now.toLocaleTimeString('en-GB')
    }

    focus() {
        this.metricNameInput.focus()
    }

    validate() {
        let returnVal = true;
        if(!this.validateInputNotEmpty(this.metricNameInput))
            returnVal = false
        
        if(!this.validateInputNotEmpty(this.dateInput))
            returnVal = false

        if(!this.validateInputNotEmpty(this.timeInput))
            returnVal = false

        if(!this.validateInputNotEmpty(this.valueInput))
            returnVal = false

        return returnVal
    }

    validateInputNotEmpty(input) {
        if(input.value.length == 0) {
            this.makeInputInvalid(input)
            return false
        }
        else {
            this.makeInputValid(input)
            return true
        }
    }

    makeInputInvalid(input) {
        input.classList.remove("border-slate-300")
        input.classList.remove("focus:ring-sky-500")
        input.classList.remove("focus:border-sky-500")
        input.classList.add("border-red-600")
        input.classList.add("focus:ring-red-500")
        input.classList.add("focus:border-red-500")
    }

    makeInputValid(input) {
        input.classList.remove("border-red-600")
        input.classList.remove("focus:ring-red-500")
        input.classList.remove("focus:border-red-500")
        input.classList.add("border-slate-300")
        input.classList.add("focus:ring-sky-500")
        input.classList.add("focus:border-sky-500")
    }

    show() {
        this.root.classList.remove("hidden")
    }

    hide() {
        this.root.classList.add("hidden")
    }
}


class AddVizualizationUI {
    root;
    metricNameInput;
    childMetricInput;
    vizSelect;
    autoComplete;
    childAutoComplete;
    autoCompleteData;

    constructor() {
        this.root = document.getElementById("visualize-metrics")
        this.metricNameInput = document.getElementById("visualize-metrics-name-input");
        this.childMetricInput = document.getElementById("visualize-metrics-child-input");
        this.vizSelect = document.getElementById("visualize-metrics-select");
        this.autoComplete = document.getElementById("visualize-name-auto-complete");
        this.childAutoComplete = document.getElementById("visualize-child-auto-complete");

        this.autoComplete.classList.add('hidden') 
        this.childAutoComplete.classList.add('hidden') 

        this.autoCompleteData = []
    }


    setUpUIHandlers() {
        const _this = this;

        document.getElementById("visualize-metrics-close-x")?.addEventListener('click', function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("visualize-metrics-close-button")?.addEventListener('click', function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("visualize-metrics-enter-button")?.addEventListener('click', async function (e) {
            let childName = _this.childMetricInput.value;
            if(childName == "")
                childName = "-"

            let viz = _this.vizSelect.options[_this.vizSelect.selectedIndex].value

            // Insert renderer
            const content = `{{renderer :metrics, ${_this.metricNameInput.value}, ${childName}, ${viz}}}`

            const block = await logseq.Editor.getCurrentBlock()
            if(block)
                await logseq.Editor.updateBlock(block.uuid, content)

            
            logseq.hideMainUI({ restoreEditingCursor: true })
            
            e.stopPropagation()
        }, false)

        document.getElementById("help-link")?.addEventListener('click', async function(e) {
            console.log("opening link")
            await logseq.App.openExternalLink('https://github.com/dangermccann/logseq-metrics#visualization-types')
            return false;
        })

        // Auto complete events
        this.autoComplete.addEventListener('mousedown', function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute('data-id'))
                return;

            _this.metricNameInput.value = e.target.textContent
            _this.autoComplete.classList.add('hidden')
        }, true)

        this.metricNameInput.addEventListener('focus', function(e) { 
            _this.prepareAutoComplete(null)
        })

        this.metricNameInput.addEventListener('blur', function(e) { 
            _this.autoComplete.classList.add('hidden') 
        })

        this.metricNameInput.addEventListener('keyup', function(e) { 
            AutoComplete.doAutoComplete(e, _this.autoComplete, _this.autoCompleteData)
        })

        // Child auto complete 
        this.childAutoComplete.addEventListener('mousedown', function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute('data-id'))
                return;

            _this.childMetricInput.value = e.target.textContent
            _this.childAutoComplete.classList.add('hidden')
        }, true)

        this.childMetricInput.addEventListener('focus', function(e) { 
            _this.prepareAutoComplete(_this.metricNameInput.value)
        })

        this.childMetricInput.addEventListener('blur', function(e) { 
            _this.childAutoComplete.classList.add('hidden') 
        })

        this.childMetricInput.addEventListener('keyup', function(e) { 
            AutoComplete.doAutoComplete(e, _this.childAutoComplete, _this.autoCompleteData)
        })

    }

    async prepareAutoComplete(parent) {
        this.autoCompleteData = await dataUtils.loadMetricNames(parent)
    }

    clear() {
        this.metricNameInput.value = '';
        this.childMetricInput.value = '';
    }

    focus() {
        this.metricNameInput.focus()
    }

    show() {
        this.root.classList.remove("hidden")
    }

    hide() {
        this.root.classList.add("hidden")
    }
}


class AutoComplete {
    static doAutoComplete(e, container, data) {
        if(e.target.value == '') {
            container.classList.add('hidden')
        }
        else {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            var results = [];
            try {
                results = AutoComplete.search(e.target.value, data)
            }
            catch(e) { }

            if(results.length === 0) {
                container.classList.add('hidden')
                return
            }
            
            let template = document.getElementById('auto-complete-template')

            results.forEach((result) => {
                let el = template.cloneNode(true)
                el.setAttribute("data-id", result.id)
                el.textContent = result.label
                el.classList.remove('hidden')
                container.appendChild(el)
            })

            container.classList.remove('hidden')
        }
    }

    static search(input, candidates) {
        let inputTokens = input.split(' ')
        let matches = []
        let inputs = []

        // Create reg expressions for each input token
        inputTokens.forEach((inputToken) => {
            inputs.push(new RegExp(inputToken, 'gi'))
        })

        // Assign a score for each candidate
        candidates.forEach((candidate) => {
            let candidateScore = 0

            let tokens = candidate.label.split(' ')
            tokens.forEach((token) => {
                inputs.forEach((rex) => {
                    if(rex.test(token))
                        candidateScore++
                })
            })

            if(candidateScore > 0) {
                matches.push({ 
                    result: candidate,
                    score: candidateScore
                })
            }
        })

        // Sort matches
        matches = matches.sort((a, b) => {
            return b.score - a.score;
        })

        // build array to return 
        let returns = []
        matches.forEach((match) => {
            returns.push(match.result)
        })

        return returns
    }
}


// bootstrap
logseq.ready().then(main).catch(console.error)
