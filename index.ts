
import '@logseq/libs'
import { BlockIdentity, PageEntity } from '@logseq/libs/dist/LSPlugin.user';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';

class Settings {
    light: ColorSettings
    dark: ColorSettings
}

class ColorSettings {
    bg_color_1: string
    bg_color_2: string
    border_color: string
    text_color: string
}


const DATA_PAGE = "metrics-plugin-data"
let settings = new Settings()
let themeMode = "dark"

const defaultSettings :Settings = {
    dark: {
        bg_color_1: "bg-gray-700",
        bg_color_2: "bg-gray-800",
        border_color: "#555",
        text_color: "text-white"
    },
    light: {
        bg_color_1: "bg-gray-50",
        bg_color_2: "bg-gray-100",
        border_color: "#ddd",
        text_color: "text-gray-900"
    }
}

async function main () {
    const mainDiv = document.getElementById('create-metric')
    if(!mainDiv) {
        console.warn("Could not find main div")
        return;
    }

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

        const viz = new Visualization()
        viz.render(metric, childMetric, visualization).then((html) => {
            logseq.provideUI({
                key: "metrics-visualization",
                slot,
                template: html
            })
        })
    })

    logseq.App.onThemeModeChanged((mode) => {
        themeMode = mode.mode
    })

    console.log("Loaded Metrics plugin")

}

class Metric {
    date :Date
    value :string

    constructor(obj :any) {
        this.date = obj.date
        this.value = obj.value
    }
}


class Visualization {
    constructor() {}

    async render(name :string, childName :string, vizualization :string) :Promise<string> {
        name = name.trim()
        childName = childName.trim()
        vizualization = vizualization.trim()

        const colors = themeMode === "dark" ? settings.dark : settings.light

        const metrics = await this.loadMetrics(name, childName)
        if(!metrics)
            return `<h2>ERROR loading ${name}</h2>`

        console.log(`Loaded ${metrics.length} metrics.  Rendering ${vizualization}`)

        let content :string | undefined = ''
        if(vizualization === 'sum')
            content = this.sum(metrics).toString()
        else if(vizualization === 'average')
            content = this.average(metrics).toString()
        else if(vizualization === 'latest')
            content = this.latest(metrics)?.value
        else
            console.log(`Unknown visualization: ${vizualization}`)

        let html = `
            <div class="w-48 flex flex-col ${colors.bg_color_1} ${colors.text_color} text-center border" 
                  style="height:11rem; border-color: ${colors.border_color}">
              <div class="w-full text-lg p-2 ${colors.bg_color_2}">`

        if(childName && childName.length > 0)
            html += childName
        else
            html += name

        html += `</div><div class="w-full text-4xl" style="margin: auto;"><span>${content}</span></div></div>`

        return html
    }

    async findBlock(tree :BlockEntity[], name :string) :Promise<BlockIdentity | null> {
        console.log(`findBlock ${name}, ${tree.length}`)
        let found :string | null = null

        tree.forEach(async function (value :BlockEntity) {
            if(value.content === name) {
                found = value.uuid
                return
            }
        })

        if(found)
            return found
        else return null
    }

    async loadMetrics(metricName :string, childName :string | null) :Promise<Metric[] | null> {
        var block :BlockEntity | null;
        const tree = await logseq.Editor.getPageBlocksTree(DATA_PAGE)
        let blockId = await this.findBlock(tree, metricName)
        
        if(!blockId) return null

        if(childName && childName.length > 0) {
            block = await logseq.Editor.getBlock(blockId, { includeChildren: true })
            blockId = await this.findBlock(block?.children as BlockEntity[], childName)
        }

        if(!blockId) return null

        block = await logseq.Editor.getBlock(blockId, { includeChildren: true })

        let metrics :Metric[] = [];
        block?.children?.forEach( (child) => {
            let parsed = JSON.parse((child as BlockEntity).content)
            metrics.push(new Metric(parsed))
        })

        return metrics
    }

    sum(metrics :Metric[]) :number {
        let sum = 0
        metrics.forEach((metric) => {
            const num = Number.parseFloat(metric.value)
            if(!isNaN(num))
                sum += num
        })
        return sum
    }

    average(metrics :Metric[]) :number {
        if(metrics.length === 0) return 0

        return this.sum(metrics) / metrics.length
    }
    
    latest(metrics :Metric[]) :Metric | null {
        if(metrics.length === 0) return null

        const sorted = metrics.sort((a, b) => {
            return (new Date(b.date).getTime() - new Date(a.date).getTime())
        })
        return sorted[0]
    }

}

class AddMetricUI {
    metricNameInput: HTMLInputElement;
    childMetricInput: HTMLInputElement;
    dateTimeInput: HTMLInputElement;
    valueInput: HTMLInputElement;

    constructor() {
        this.metricNameInput = document.getElementById("metric-name-input") as HTMLInputElement;
        this.childMetricInput = document.getElementById("child-metric-input") as HTMLInputElement;
        this.dateTimeInput = document.getElementById("date-time-input") as HTMLInputElement;
        this.valueInput = document.getElementById("value-input") as HTMLInputElement;
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
                await _this.enterMetric(_this.metricNameInput.value, _this.childMetricInput.value, 
                    _this.formatMetric())

                logseq.hideMainUI({ restoreEditingCursor: true })
            }
            else 
                console.log("Validation failed")
            
            e.stopPropagation()
        }, false)
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

    validateInputNotEmpty(input :HTMLInputElement) {
        if(input.value.length == 0) {
            this.makeInputInvalid(input)
            return false
        }
        else {
            this.makeInputValid(input)
            return true
        }
    }

    validateInputIsDate(input :HTMLInputElement) {
        if(isNaN(Date.parse(input.value))) {
            this.makeInputInvalid(input)
            return false
        }
        else {
            this.makeInputValid(input)
            return true
        }
    }

    makeInputInvalid(input :HTMLInputElement) {
        input.classList.remove("border-slate-300")
        input.classList.remove("focus:ring-sky-500")
        input.classList.remove("focus:border-sky-500")
        input.classList.add("border-red-600")
        input.classList.add("focus:ring-red-500")
        input.classList.add("focus:border-red-500")
    }

    makeInputValid(input :HTMLInputElement) {
        input.classList.remove("border-red-600")
        input.classList.remove("focus:ring-red-500")
        input.classList.remove("focus:border-red-500")
        input.classList.add("border-slate-300")
        input.classList.add("focus:ring-sky-500")
        input.classList.add("focus:border-sky-500")
    }

    formatMetric() :string {
        const date = new Date(this.dateTimeInput.value)
        const val = { date: date, value: this.valueInput.value }
        return JSON.stringify(val)
    }

    async enterMetric(name :string, childName :string, entry :string) {
        let page = await logseq.Editor.getPage(DATA_PAGE)
        if(!page) {
            page = await logseq.Editor.createPage(DATA_PAGE)
            
            if(page) {
                console.log(`Created page ${DATA_PAGE}`)
            }
            else {
                console.log(`Failed to create page ${DATA_PAGE}`)
                return
            }
        }
        else {
            console.log(`Loaded page ${DATA_PAGE}`)
        }

        let tree = await logseq.Editor.getPageBlocksTree(DATA_PAGE)

        console.log(`Loaded tree with ${tree.length} blocks`)

        var blockId;
        if(tree.length == 0) {
            console.log(`Page is empty.  Inserting block ${name}`)
            blockId = (await logseq.Editor.appendBlockInPage(DATA_PAGE, name))?.uuid
        }
        else {
            blockId = await this.findOrCreateBlock(tree, name)
            if(blockId === null) {
                console.log("Can not locate block to insert metric")
                return
            }
        }

        if(childName)
        {
            let parentBlock = await logseq.Editor.getBlock(blockId, { includeChildren: true })
            if(parentBlock?.children?.length === 0) {
                let block = await logseq.Editor.insertBlock(blockId, childName, {
                    before: false, sibling: false, isPageBlock: false
                })
                blockId = block?.uuid
            }
            else {
                let childId = await this.findOrCreateBlock(parentBlock?.children as BlockEntity[], childName)
                if(childId === null) {
                    console.log("Can not locate block to insert metric")
                    return
                }
                blockId = childId
            }
            
        }
        

        const formatted = this.formatMetric()
        let metricBlock = await logseq.Editor.insertBlock(blockId, formatted, {
            before: false, sibling: false, isPageBlock: false
        })
        if(!metricBlock) {
            console.log(`Failed to insert metric: ${formatted}`)
        }
        else {
            console.log(`Metric inserted successfully: ${formatted}`)
        }
    }

    async findOrCreateBlock(tree :BlockEntity[], name :string) :Promise<string | null> {
        console.log(`findOrCreateBlock ${name}, ${tree.length}`)
        let found :string | null = null

        tree.forEach(async function (value :BlockEntity) {
            console.log(`Iteration block ${value}`)
            if(value.content === name) {
                console.log(`Iteration name match ${value.content} , ${value.children}`)
                found = value.uuid
                return
            }
        })

        if(found)
            return found

        console.log(`Block not found, inserting block at ${tree[tree.length - 1].uuid}`)

        let block = await logseq.Editor.insertBlock(tree[tree.length - 1].uuid, name, {
            before: false, sibling: true, isPageBlock: false
        })
        if(!block) {
            console.log(`Failed to create block ${name}`)
            return null
        }

        console.log(`Created block ${name} with uuid ${block.uuid}`)

        return block?.uuid
    }
}


// bootstrap
logseq.ready(main).catch(console.error)