
import '@logseq/libs'

async function main () {
    logseq.Editor.registerSlashCommand("Metrics", async () => {
        

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

// bootstrap
logseq.ready(main).catch(console.error)