import '@logseq/libs'
import { BlockIdentity, PageEntity } from '@logseq/libs/dist/LSPlugin.user';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { DataUtils, Metric } from './data-utils'
import { Settings, ColorSettings, defaultSettings } from './settings'


let settings = new Settings()
let themeMode = "dark"
var dataUtils;

async function main () {
    const mainDiv = document.getElementById('create-metric')
    if(!mainDiv) {
        console.warn("Could not find main div")
        return;
    }

    dataUtils = new DataUtils(logseq)

    // "light" or "dark"
    themeMode = (await logseq.App.getUserConfigs()).preferredThemeMode;
    
    // load settings and merge with defaults if none are present
    settings = Object.assign({}, defaultSettings, logseq.settings)

    // save settings so they can be modified later
    logseq.updateSettings(settings)

    // prepare UI for adding metrics
    let addMetricUI = new AddMetricUI();
    addMetricUI.setUpUIHandlers();

    logseq.Editor.registerSlashCommand("Metrics Add", async () => {
        const pos = await logseq.Editor.getEditingCursorPosition()
        if(!pos) return

        Object.assign(mainDiv.style, {
            top: pos.top + pos.rect.top + 'px',
            left: pos.left + 'px',
        })
        addMetricUI.clear()
        logseq.showMainUI()
    })

    logseq.Editor.registerSlashCommand("Metrics Visualize", async () => {
        const content = "{{renderer :metrics, Metric Name, Child Metric Name, Vizualization Name }}"

        const block = await logseq.Editor.getCurrentBlock()
        if(block)
            await logseq.Editor.updateBlock(block.uuid, content)


        //await logseq.Editor.insertAtEditingCursor(content, )
        
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
        themeMode = mode.mode
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
        else if(vizualization === 'line' || vizualization === 'bar')
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
    metricNameInput;
    childMetricInput;
    dateTimeInput;
    valueInput;

    constructor() {
        this.metricNameInput = document.getElementById("metric-name-input");
        this.childMetricInput = document.getElementById("child-metric-input");
        this.dateTimeInput = document.getElementById("date-time-input");
        this.valueInput = document.getElementById("value-input");
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
    }

    formatMetric() {
        const date = new Date(this.dateTimeInput.value)
        const val = { date: date, value: this.valueInput.value }
        return JSON.stringify(val)
    }

    clear() {
        this.metricNameInput.value = '';
        this.childMetricInput.value = '';
        this.dateTimeInput.value = (new Date()).toLocaleString();
        this.valueInput.value = '';
    }

    validate() {
        let returnVal = true;
        if(!this.validateInputNotEmpty(this.metricNameInput))
            returnVal = false
        
        if(!this.validateInputNotEmpty(this.dateTimeInput))
            returnVal = false
        else if(!this.validateInputIsDate(this.dateTimeInput))
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

    validateInputIsDate(input) {
        if(isNaN(Date.parse(input.value))) {
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

    
}


// bootstrap
logseq.ready(main).catch(console.error)