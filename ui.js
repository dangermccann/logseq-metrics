import '@logseq/libs'
import { DataUtils, logger } from './data-utils'


var dataUtils
console = logger


async function refreshBlock(uuid) {
    const block = await logseq.Editor.getBlock(uuid)
    if(!block || !block.content)
        return

    await logseq.Editor.updateBlock(uuid, "")
    await logseq.Editor.updateBlock(uuid, block.content)
    console.debug(`Refreshed block: ${uuid}`)
}


export class AddMetricUI {
    root;
    metricNameInput;
    childMetricInput;
    dateInput;
    timeInput;
    valueInput;
    autoComplete;
    childAutoComplete;
    autoCompleteData;

    constructor(visualizationInstances) {
        this.root = document.getElementById("add-metric")
        this.metricNameInput = document.getElementById("metric-name-input")
        this.childMetricInput = document.getElementById("child-metric-input")
        this.dateInput = document.getElementById("date-input")
        this.timeInput = document.getElementById("time-input")
        this.valueInput = document.getElementById("value-input")
        this.autoComplete = document.getElementById("metric-name-auto-complete")
        this.childAutoComplete = document.getElementById("child-metric-auto-complete")
    
        this.autoCompleteData = []

        if(!dataUtils)
            dataUtils = new DataUtils(logseq)

        this.visualizationInstances = visualizationInstances
    }

    setUpUIHandlers() {
        const _this = this

        document.addEventListener("keydown", function (e) {
            //console.log(e.key)
            if (e.keyCode === 27) {
              logseq.hideMainUI({ restoreEditingCursor: true })
            }
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-close-x")?.addEventListener("click", function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-close-button")?.addEventListener("click", function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("create-metrics-enter-button")?.addEventListener("click", async function (e) {
            if(_this.validate()) {
                const name = _this.metricNameInput.value
                const childName = _this.childMetricInput.value
                const metricObj = _this.formatMetric()

                // add to metrics data page
                await dataUtils.enterMetric(name, childName, JSON.stringify(metricObj))

                // add to journal if checked
                if(document.getElementById("journal-check").checked) {
                    await dataUtils.addToJournal(name, childName, metricObj)
                    console.log("Added to journal")
                }

                logseq.hideMainUI({ restoreEditingCursor: true })

                const blocksToRefresh = []
                for(const blockInstances of Object.values(_this.visualizationInstances))
                    for(const viz of Object.values(blockInstances))
                        if(viz.metric === _this.metricNameInput.value)
                            if(!blocksToRefresh.includes(viz.uuid))
                                blocksToRefresh.push(viz.uuid)
                for(const uuid of blocksToRefresh)
                    await refreshBlock(uuid)
            }
            else 
                console.log("Validation failed")
            
            e.stopPropagation()
        }, false)

        // Auto complete events
        this.autoComplete.addEventListener("mousedown", function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute("data-id"))
                return

            _this.metricNameInput.value = e.target.textContent
            _this.autoComplete.classList.add("hidden")
        }, true)

        this.metricNameInput.addEventListener("focus", function(e) { 
            _this.prepareAutoComplete(null)
        })

        this.metricNameInput.addEventListener("blur", function(e) { 
            _this.autoComplete.classList.add("hidden") 
        })

        this.metricNameInput.addEventListener("keyup", function(e) { 
            AutoComplete.doAutoComplete(e, _this.autoComplete, _this.autoCompleteData)
        })

        // Child auto complete 
        this.childAutoComplete.addEventListener("mousedown", function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute("data-id"))
                return

            _this.childMetricInput.value = e.target.textContent
            _this.childAutoComplete.classList.add("hidden")
        }, true)

        this.childMetricInput.addEventListener("focus", function(e) { 
            _this.prepareAutoComplete(_this.metricNameInput.value)
        })

        this.childMetricInput.addEventListener("blur", function(e) { 
            _this.childAutoComplete.classList.add("hidden") 
        })

        this.childMetricInput.addEventListener("keyup", function(e) { 
            AutoComplete.doAutoComplete(e, _this.childAutoComplete, _this.autoCompleteData)
        })
    }

    async prepareAutoComplete(parent) {
        this.autoCompleteData = await dataUtils.loadMetricNames(parent)
    }

    formatMetric() {
        const date = new Date(`${this.dateInput.value} ${this.timeInput.value}`)
        const val = { date: date, value: this.valueInput.value }
        return val
    }

    clear() {
        this.metricNameInput.value = ""
        this.childMetricInput.value = ""
        this.valueInput.value = ""

        document.getElementById("journal-check").checked = logseq.settings.add_to_journal || false

        let now = new Date()
        this.dateInput.value = now.toLocaleDateString("en-CA")
        this.timeInput.value = now.toLocaleTimeString("en-GB")
    }

    focus() {
        this.metricNameInput.focus()
    }

    validate() {
        let returnVal = true

        // IMPORTANT: before v0.15 there are no restrictions on metric and child metric names
        // So some users may have inapropriate characters in names
        // Clearing usage is necessary for any metrics-tree operations
        this.metricNameInput.value = dataUtils.clearName(this.metricNameInput.value)
        this.childMetricInput.value = dataUtils.clearName(this.childMetricInput.value)

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


export class AddVizualizationUI {
    root;
    metricNameInput;
    childMetricInput;
    vizSelect;
    autoComplete;
    childAutoComplete;
    autoCompleteData;

    constructor() {
        this.root = document.getElementById("visualize-metrics")
        this.metricNameInput = document.getElementById("visualize-metrics-name-input")
        this.childMetricInput = document.getElementById("visualize-metrics-child-input")
        this.vizSelect = document.getElementById("visualize-metrics-select")
        this.autoComplete = document.getElementById("visualize-name-auto-complete")
        this.childAutoComplete = document.getElementById("visualize-child-auto-complete")

        this.autoComplete.classList.add("hidden") 
        this.childAutoComplete.classList.add("hidden") 

        this.autoCompleteData = []

        if(!dataUtils)
            dataUtils = new DataUtils(logseq)
    }

    setUpUIHandlers() {
        const _this = this

        document.getElementById("visualize-metrics-close-x")?.addEventListener("click", function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("visualize-metrics-close-button")?.addEventListener("click", function (e) {
            logseq.hideMainUI({ restoreEditingCursor: true })
            e.stopPropagation()
        }, false)

        document.getElementById("visualize-metrics-enter-button")?.addEventListener("click", async function (e) {
            let childName = _this.childMetricInput.value
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

        document.getElementById("help-link")?.addEventListener("click", async function(e) {
            console.log("opening link")
            await logseq.App.openExternalLink("https://github.com/dangermccann/logseq-metrics#visualization-types")
            return false
        })

        // Auto complete events
        this.autoComplete.addEventListener("mousedown", function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute("data-id"))
                return

            _this.metricNameInput.value = e.target.textContent
            _this.autoComplete.classList.add("hidden")
        }, true)

        this.metricNameInput.addEventListener("focus", function(e) {
            _this.prepareAutoComplete(null)
        })

        this.metricNameInput.addEventListener("blur", function(e) {
            _this.autoComplete.classList.add("hidden") 
        })

        this.metricNameInput.addEventListener("keyup", function(e) {
            AutoComplete.doAutoComplete(e, _this.autoComplete, _this.autoCompleteData)
        })

        // Child auto complete 
        this.childAutoComplete.addEventListener("mousedown", function(e) {
            e.stopPropagation()

            if(!e.target.getAttribute("data-id"))
                return

            _this.childMetricInput.value = e.target.textContent
            _this.childAutoComplete.classList.add("hidden")
        }, true)

        this.childMetricInput.addEventListener("focus", function(e) { 
            _this.prepareAutoComplete(_this.metricNameInput.value)
        })

        this.childMetricInput.addEventListener("blur", function(e) { 
            _this.childAutoComplete.classList.add("hidden") 
        })

        this.childMetricInput.addEventListener("keyup", function(e) { 
            AutoComplete.doAutoComplete(e, _this.childAutoComplete, _this.autoCompleteData)
        })

    }

    async prepareAutoComplete(parent) {
        this.autoCompleteData = await dataUtils.loadMetricNames(parent)
    }

    clear() {
        this.metricNameInput.value = ""
        this.childMetricInput.value = ""
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


export class AutoComplete {
    static doAutoComplete(e, container, data) {
        if(e.target.value === "") {
            container.classList.add("hidden")
        } else {
            while (container.firstChild)
                container.removeChild(container.firstChild)

            var results = []
            try {
                results = AutoComplete.search(e.target.value, data)
            }
            catch(e) { }

            if(results.length === 0) {
                container.classList.add("hidden")
                return
            }
            
            let template = document.getElementById("auto-complete-template")

            results.forEach((result) => {
                let el = template.cloneNode(true)
                el.setAttribute("data-id", result.id)
                el.textContent = result.label
                el.classList.remove("hidden")
                container.appendChild(el)
            })

            container.classList.remove("hidden")
        }
    }

    static search(input, candidates) {
        let inputTokens = input.split(" ")
        let matches = []
        let inputs = []

        // Create reg expressions for each input token
        inputTokens.forEach((inputToken) => {
            inputs.push(new RegExp(inputToken, "gi"))
        })

        // Assign a score for each candidate
        candidates.forEach((candidate) => {
            let candidateScore = 0

            let tokens = candidate.label.split(" ")
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
            return b.score - a.score
        })

        // build array to return 
        let returns = []
        matches.forEach((match) => {
            returns.push(match.result)
        })

        return returns
    }
}
