import '@logseq/libs'
import { DataUtils, Metric } from './data-utils'
import { Settings, ColorSettings, defaultSettings, mergeDeep } from './settings'

let settings = new Settings()
let themeMode = "dark"
var dataUtils;

async function main () {
    const addMetricEl = document.getElementById('add-metric')
    if(!addMetricEl) {
        console.warn("Could not find main div")
        return;
    }

    const addVisualizationEl = document.getElementById('visualize-metrics')

    dataUtils = new DataUtils(logseq)

    // "light" or "dark"
    themeMode = (await logseq.App.getUserConfigs()).preferredThemeMode;
    
    if(themeMode === 'dark')
        document.body.classList.add("dark")
    
    // load settings and merge with defaults if none are present
    settings = Object.assign({}, defaultSettings)
    mergeDeep(settings, logseq.settings)

    // save settings so they can be modified later
    logseq.updateSettings(settings)

    // prepare UI for adding metrics
    let addMetricUI = new AddMetricUI();
    addMetricUI.setUpUIHandlers();

    let addVizualizationUI = new AddVizualizationUI();
    addVizualizationUI.setUpUIHandlers();

    logseq.Editor.registerSlashCommand("Metrics Add", async () => {
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

    logseq.Editor.registerSlashCommand("Metrics Visualize", async () => {
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

    logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
        const [type, metric, childMetric, visualization] = payload.arguments
        if(type !== ":metrics") return

        console.log(`onMacroRendererSlotted slot: ${slot} | type: ${visualization}`)

        const viz = new Visualization()

        // TODO: figure out if we need this 'key' to be durable, as in, set to something unique that is encoded in
        // the {{renderer ...}} block.  The 'slot' value will change each time its rendered.  
        viz.render(payload.uuid, slot, metric, childMetric, visualization).then((html) => {
            logseq.provideUI({
                key: `metrics-${slot}`,
                slot,
                template: html,
                reset: true,
                style: { flex: 1 }
            })
        })
    })

    logseq.App.onThemeModeChanged((mode) => {
        themeMode = mode.mode;
        if(themeMode === 'dark')
            document.body.classList.add("dark")
        else 
            document.body.classList.remove("dark")
    })

    logseq.provideStyle(`
        .metrics-iframe {
            width: 100%;
            height: ${settings.chart_height}px;
            margin: 0;
        }`
    )

    console.log("Loaded Metrics plugin")

}

function getPluginDir() {
    const iframe = parent?.document?.getElementById(`${logseq.baseInfo.id}_iframe`,)
    const pluginSrc = iframe.src
    const index = pluginSrc.lastIndexOf("/")
    return pluginSrc.substring(0, index)
}



class Visualization {
    constructor() {}

    async render(uuid, slot, name, childName, vizualization) {
        name = name.trim()
        childName = childName.trim()
        vizualization = vizualization.trim()

        if(childName === '-') 
            childName = ''


        const slotEl = parent.document.getElementById(slot)
        if(slotEl)
            slotEl.style.width = "100%"

        const colors = themeMode === "dark" ? settings.dark : settings.light

        // TODO: don't load the metrics if we're going to embed an iframe 
        const metrics = await dataUtils.loadMetrics(name, childName)
        //if(!metrics)
        //    return `<h2>ERROR loading ${name}</h2>`

        console.log(`Loaded ${metrics.length} metrics.  Rendering ${vizualization}`)

        let content = ''
        if(vizualization === 'sum')
            content = this.sum(metrics).toString()
        else if(vizualization === 'average')
            content = this.average(metrics).toString()
        else if(vizualization === 'latest')
            content = this.latest(metrics)?.value
        else if(vizualization === 'line' || vizualization === 'cumulative-line' || vizualization === 'bar')
            return this.iframe(uuid, name, childName, vizualization)
        else
            console.log(`Unknown visualization: ${vizualization}`)

        let html = `
            <div class="w-48 flex flex-col text-center border" 
                  style="height:11rem; background-color: ${colors.bg_color_1};
                  color: ${colors.text_color};
                  border-color: ${colors.border_color};">
              <div class="w-full text-lg p-2" style="background-color: ${colors.bg_color_2};">`

        if(childName && childName.length > 0)
            html += childName
        else
            html += name

        html += `</div><div class="w-full text-4xl" style="margin: auto;"><span>${content}</span></div></div>`

        return html
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

        return this.sum(metrics) / metrics.length
    }
    
    latest(metrics) {
        if(metrics.length === 0) return null

        const sorted = metrics.sort((a, b) => {
            return (new Date(b.date).getTime() - new Date(a.date).getTime())
        })
        return sorted[0]
    }

    iframe(uuid, name, childName, vizualization) {
        return `<iframe class="metrics-iframe" src="${getPluginDir()}/inline.html"
            data-metricname="${name}" data-childname="${childName}"
            data-frame="${logseq.baseInfo.id}_iframe" data-uuid="${uuid}"
            data-visualization="${vizualization}"></iframe>`
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
                await dataUtils.enterMetric(_this.metricNameInput.value, _this.childMetricInput.value, 
                    _this.formatMetric())

                logseq.hideMainUI({ restoreEditingCursor: true })
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
logseq.ready(main).catch(console.error)