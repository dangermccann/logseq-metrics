export class Settings {
    light
    dark
}

export class ColorSettings {
    bg_color_1
    bg_color_2
    border_color
    text_color
    color_1
    color_2
    color_3
    color_4
    color_5
}

export const defaultSettings = {
    dark: {
        bg_color_1: "#374151",
        bg_color_2: "#1F2937",
        border_color: "#4f5e75",
        text_color: "#fff",
        color_1: "#2A9D8F",
        color_2: "#E9C46A",
        color_3: "#F4A261",
        color_4: "#E76F51",
        color_5: "#264653"
    },
    light: {
        bg_color_1: "#F9FAFB",
        bg_color_2: "#F3F4F6",
        border_color: "#ddd",
        text_color: "#111827",
        color_1: "#2A9D8F",
        color_2: "#E9C46A",
        color_3: "#F4A261",
        color_4: "#E76F51",
        color_5: "#264653"
    },
    chart_height: 400
}