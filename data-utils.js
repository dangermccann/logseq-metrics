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
    static async findBlock(tree, name) {
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

    static async enterMetric(name, childName, entry) {
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
            blockId = await DataUtils.findOrCreateBlock(tree, name)
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
                let childId = await this.findOrCreateBlock(parentBlock?.children, childName)
                if(childId === null) {
                    console.log("Can not locate block to insert metric")
                    return
                }
                blockId = childId
            }
            
        }
        
        let metricBlock = await logseq.Editor.insertBlock(blockId, entry, {
            before: false, sibling: false, isPageBlock: false
        })
        if(!metricBlock) {
            console.log(`Failed to insert metric: ${entry}`)
        }
        else {
            console.log(`Metric inserted successfully: ${entry}`)
        }
    }

    static async findOrCreateBlock(tree, name) {
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

    static async loadMetrics(metricName, childName) {
        var block;
        const tree = await logseq.Editor.getPageBlocksTree(DATA_PAGE)
        let blockId = await DataUtils.findBlock(tree, metricName)
        
        if(!blockId) return []

        if(childName && childName.length > 0) {
            block = await logseq.Editor.getBlock(blockId, { includeChildren: true })
            blockId = await DataUtils.findBlock(block?.children, childName)
        }

        if(!blockId) return []

        block = await logseq.Editor.getBlock(blockId, { includeChildren: true })

        let metrics = [];
        if(childName && childName.length > 0) {
            block?.children?.forEach( (child) => {
                let parsed = JSON.parse((child).content)
                metrics.push(new Metric(parsed))
            })
        }
        else {
            block?.children?.forEach( (child) => {
                child.children.forEach( (grandchild) => {
                    let parsed = JSON.parse((grandchild).content)
                    metrics.push(new Metric(parsed))
                })
            })
        }

        return metrics
    }
}