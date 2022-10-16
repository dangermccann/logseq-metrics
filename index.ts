
import '@logseq/libs'
import { PageEntity } from '@logseq/libs/dist/LSPlugin.user';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';

const DATA_PAGE = "metrics-plugin-data"

async function main () {
    const mainDiv = document.getElementById('create-metric')
    if(!mainDiv) {
        console.warn("Could not find main div")
        return;
    }

    // "light" or "dark"
    const themeMode = (await logseq.App.getUserConfigs()).preferredThemeMode;

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
        const content = "{{renderer :metrics, Metric Name, Vizualization Name }}"

        const block = await logseq.Editor.getCurrentBlock()
        if(block)
            await logseq.Editor.updateBlock(block.uuid, content)


        //await logseq.Editor.insertAtEditingCursor(content, )
        
    })

    logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
        const [type, metric, visualization] = payload.arguments
        if(type !== ":metrics") return

        logseq.provideUI({
            key: "metrics-visualization",
            slot,
            template: `
                <h2>${metric} | ${visualization}</h2>
            `
        })
    })

    console.log("Loaded Metrics plugin")

}

class Metric {
    date :Date
    value :string
}

class Visualization {
    constructor() {}

    loadMetrics(metric :string) :Metric[] | null {
        // ...
        let parts = metric.split('/')
        

        return null
    }

    sum(metrics :Metric[]) :number {
        return 0
    }

    average(metrics :Metric[]) :number {
        return 0
    }
    
    mostRecent(metrics :Metric[]) :Metric | null {
        return null
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