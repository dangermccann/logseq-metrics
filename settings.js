export const settingsDescription = [
  {
    key: "chart_height",
    type: "number",
    title: "Height of all charts in pixels",
    description: "Width selects automatically based on window size, theme settings and wide mode. You only need to specify height.",
    default: 400,
  },
  {
    key: "add_to_journal",
    type: "boolean",
    title: 'Checkbox state in add metric UI',
    description: 'Wether "Also add entry to Journal" checked or not by default',
    default: true,
  },
  {
    key: "journal_title",
    type: "string",
    title: "When entry adds to journal it comes along with this string",
    description: "Placeholder ${metric} can be used here: it will be replaced with metric name. Hint: stay some hashtag here to easily find all journal metrics. Only affects new entries.",
    default: "#Metrics ${metric}",
  },
  {
    key: "data_page_name",
    type: "string",
    title: "Plugin stores all metrics data in special page with this name",
    description: "⚠️ If you change this settings and you already have entered some metrics data, you need to move it to new page manually!",
    default: "metrics-plugin-data",
  },
]


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
