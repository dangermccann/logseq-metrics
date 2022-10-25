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
        console.log(`findBlock ${name}, ${tree.length}`)
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
            page = await this.logseq.Editor.createPage(DATA_PAGE)
            
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
        if(childName && childName.length > 0) {
            block?.children?.forEach( (child) => {
                let parsed = JSON.parse((child).content)
                metrics.push(new Metric(parsed))
            })
        }
        else {
            var parsed;
            block?.children?.forEach( (child) => {
                // Child block may be an entry or it may be a label for a child metric
                // Try to parse the content to see if it's a valid metric
                try {
                    parsed = JSON.parse(child.content)
                    if(parsed.value && parsed.date)
                    metrics.push(new Metric(parsed))
                } catch {
                    child.children.forEach((grandchild) => {
                        parsed = JSON.parse(grandchild.content)
                        metrics.push(new Metric(parsed))
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
}