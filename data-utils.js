import '@logseq/libs'

const DATA_PAGE = "metrics-plugin-data"

export class Metric {
    date
    value

constructor(obj) {
        this.date = obj.date
        this.value = obj.value
    }
}

export class DataUtils {
    constructor(_logseq) {
        this.logseq = _logseq;
    }

    async findBlock(tree, name) {
        let found = null

        tree.forEach(async function (value) {
            if(value.content === name) {
                found = value.uuid
                return
            }
        })

        if(found)
            return found
        else return null
    }

    async enterMetric(name, childName, entry) {
        let page = await this.logseq.Editor.getPage(DATA_PAGE)
        if(!page) {
            page = await this.logseq.Editor.createPage(DATA_PAGE, {}, { redirect: false })
            
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

        let tree = await this.logseq.Editor.getPageBlocksTree(DATA_PAGE)

        console.log(`Loaded tree with ${tree.length} blocks`)

        var blockId;
        if(tree.length == 0) {
            console.log(`Page is empty.  Inserting block ${name}`)
            blockId = (await this.logseq.Editor.appendBlockInPage(DATA_PAGE, name))?.uuid
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
            let parentBlock = await this.logseq.Editor.getBlock(blockId, { includeChildren: true })
            if(parentBlock?.children?.length === 0) {
                let block = await this.logseq.Editor.insertBlock(blockId, childName, {
                    before: false, sibling: false, isPageBlock: false
                })
                blockId = block?.uuid
            }
            else {
                let childId = await this.findOrCreateBlock(parentBlock?.children, childName)
                if(childId === null) {
                    console.log("Can not locate block to insert metric")
                    return
                }
                blockId = childId
            }
            
        }
        
        let metricBlock = await this.logseq.Editor.insertBlock(blockId, entry, {
            before: false, sibling: false, isPageBlock: false
        })
        if(!metricBlock) {
            console.log(`Failed to insert metric: ${entry}`)
        }
        else {
            console.log(`Metric inserted successfully: ${entry}`)
            
            let formattedName = name;
            if(childName)
                formattedName += " :: " + childName
            
            logseq.UI.showMsg(`Inserted data point for metric ${formattedName}.`)
        }
    }

    async findOrCreateBlock(tree, name) {
        console.log(`findOrCreateBlock ${name}, ${tree.length}`)
        let found = null

        tree.forEach(async function (value) {
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

        let block = await this.logseq.Editor.insertBlock(tree[tree.length - 1].uuid, name, {
            before: false, sibling: true, isPageBlock: false
        })
        if(!block) {
            console.log(`Failed to create block ${name}`)
            return null
        }

        console.log(`Created block ${name} with uuid ${block.uuid}`)

        return block?.uuid
    }

    async loadLineChart(metricName, mode) {
        // Scenarios:
        // 1. Single dataset using data from immediate children
        // 2. Multiple datasets where data comes from grandchildren 
        
        // Modes:
        // 1. Standard - data points plotted normally along y-axis
        // 2. Cumulative - values are ordered chronologically and the cumulative sum is plotted  

        // Return value: 
        // datasets: [ { data: [ { x: (date), y: (float) } }, { ... } ] } ]
        function prepareMetrics(metrics, mode) {
            let data = [];
            let sum = 0;
            metrics.forEach(metric => {
                var date, value;
                try {
                    let y = parseFloat(metric.value)
                    sum += y
                    date = new Date(metric.date)
                    value = { x: date, y: (mode === 'cumulative') ? sum : y }
                } catch { }
                
                data.push(value)
            })
            return data;
        }

        let datasets = []
        let childNames = await this.loadMetricNames(metricName)
        if(childNames.length > 0) {
            for(var i = 0; i < childNames.length; i++) {
                var child = childNames[i];
                let childName = child.label;
                let metrics = await this.loadMetrics(metricName, childName)
                metrics = this.sortMetricsByDate(this.filterInvalidMetrics(metrics))
                datasets.push( { data: prepareMetrics(metrics, mode), label: childName } )
            }
        }
        else {
            let metrics = await this.loadMetrics(metricName)
            metrics = this.sortMetricsByDate(this.filterInvalidMetrics(metrics))
            datasets.push( { data: prepareMetrics(metrics, mode) } )
        }

        return datasets;
    }

    // Remove any metrics that have non-numeric values or invalid dates
    filterInvalidMetrics(metrics) {
        var filtered = []
        metrics.forEach(metric => {
            if(isNaN(parseFloat(metric.value)))
                return;
            if(isNaN(new Date(metric.date).valueOf()))
                return;
            filtered.push(metric)
        })
        return filtered;
    }

    // Chart.js requires data points to be sorted along the y-axis
    sortMetricsByDate(metrics) {
        var sorted = metrics.sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        })
        return sorted;
    }

    parseMetric(content) {
        let parsed = null;
        try {
            parsed = JSON.parse(content)
            if(parsed.value && parsed.date)
                return new Metric(parsed)

        }
        finally {
            return parsed;
        }
    }

    async loadMetrics(metricName, childName) {
        var block;
        const tree = await this.logseq.Editor.getPageBlocksTree(DATA_PAGE)
        let blockId = await this.findBlock(tree, metricName)
        
        if(!blockId) return []

        if(childName && childName.length > 0) {
            block = await this.logseq.Editor.getBlock(blockId, { includeChildren: true })
            blockId = await this.findBlock(block?.children, childName)
        }

        if(!blockId) return []

        block = await this.logseq.Editor.getBlock(blockId, { includeChildren: true })

        let metrics = [];
        var metric;
        if(childName && childName.length > 0) {
            block?.children?.forEach( (child) => {
                metric = this.parseMetric(child.content)
                if(metric)
                    metrics.push(metric)
            })
        }
        else {
            block?.children?.forEach( (child) => {
                // Child block may be an entry or it may be a label for a child metric
                // Try to parse the content to see if it's a valid metric
                metric = this.parseMetric(child.content)
                if(metric) {
                    metrics.push(metric)
                }
                else {
                    child.children.forEach((grandchild) => { 
                        metric = this.parseMetric(grandchild.content)
                        if(metric)
                            metrics.push(metric)
                    })
                }
            })
        }

        return metrics
    }

    async loadChildMetrics(metricName) {
        console.log(`loadChildMetrics ${metricName}`)
        var metrics = { };
    
        const tree = await this.logseq.Editor.getPageBlocksTree(DATA_PAGE)
    
        console.log(`Loaded tree ${tree}`)
    
        let blockId = await this.findBlock(tree, metricName)
        
        if(!blockId) return metrics;
    
        var block = await this.logseq.Editor.getBlock(blockId, { includeChildren: true })
    
        block?.children?.forEach( (child) => {
            let parsed = this.parseMetric(child.content);
            if(parsed) { 
                // Only include child metrics
            }
            else if(child.content.length > 0) {
                metrics[child.content] = []
                child.children.forEach((grandchild) => {
                    parsed = this.parseMetric(grandchild.content)
                    if(parsed)
                        metrics[child.content].push(parsed)
                })
            }
        })
    
        return metrics;
    }

    // Returns list of top-level metric names if `parent` is null.  
    // Returns list of names of child metrics if `parent` is non null.  
    async loadMetricNames(parent) {
        const tree = await this.logseq.Editor.getPageBlocksTree(DATA_PAGE)
        let names = []

        if(parent) {
            let blockId = await this.findBlock(tree, parent)
            let block = await this.logseq.Editor.getBlock(blockId, { includeChildren: true })
            block?.children?.forEach((child) => {
                try {
                    JSON.parse(child.content)
                }
                catch {
                    if(child.content.indexOf("{{renderer") === -1) {
                        names.push({ 
                            id: names.length,
                            uuid: child.uuid,
                            label: child.content
                        })
                    }
                }
            })
        }
        else {
            tree.forEach(async function (value) {
                if(value.content.indexOf("{{renderer") === -1) {
                    names.push({ 
                        id: names.length,
                        uuid: value.uuid,
                        label: value.content
                    })
                }
            })
        }
        return names
    }
}