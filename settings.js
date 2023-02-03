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
    chart_height: 400,
    add_to_journal: false,
    journal_title: "#Metrics ${metric}",
    data_page_name: "metrics-plugin-data"
}


/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}


/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}
