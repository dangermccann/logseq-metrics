# Logseq Metrics Plugin
A Logseq plugin for tracking and mesuring personal habits, goals, business results and just about anything else that can be counted and displayed on a chart.  

![Demo](./images/demo.gif)

The plugin provides an interface for storing Metrics and Data Points inside your Logseq graph.  A Metric can be anything that you can measure: exercise minutes, hours of study time, calories consumed, blood pressure readings, outdoor temperature, etc.  A Data Point is a single measurement taken at a specific date and time.  

The plugin also supports Child Metrics to allow logically similar Metrics to be organized and visualized together.  For example, a Metric for measuring exercise minutes can have Child Metrics for sub-categories of exercise such as running, cycling, cardio and stregnth training.  

## New 
As of verion 0.22 properties bar chars are now supported.   [Read more](#properties-bar-chart).

## Usage 

There are two ways to provide the data that this plugin needs to display graphs. One is the built-in "Metrics Add" command, which captures and writes your data into the metrics-plugin-data page. The other way is to simply store your own data as Journal properties and visualize the data using a [Properties Chart](#properties-charts). Simply add weight:: 20 to the first bullet of any Journal page, and this plugin can find and plot those values.

- **Metrics → Add** – Runs via `Command Palette` (⌘⇧P or Ctrl+Shift+P). Displays an interface to store a single Data Point for a Metric (and optionally a Child Metric) that you specify.  
- **Metrics → Visualize** – `Slash-command` (type "/" while editing a block). Displays an interface to insert a [Card](#card), [Bar Chart](#bar-chart) or [Line Chart](#line-chart) visualization into the current block on the current page.  
- **Metrics → Properties Line Chart** – `Slash-command` (type "/" while editing a block). Inserts a line chart that is populated from querying property values in your journal.  [more...](#properties-charts)
- **Metrics → Properties Bar Chart** – `Slash-command` (type "/" while editing a block). Inserts a bar chart that is populated from querying property values in your journal.  [more...](#properties-charts)

## Visualization Types

You embed a visualization in your graph using the **Metrics → Visualize** slash-command.  


### Card
A card displays a single value calcualted from the Data Points for a single Metric or Child Metric.  The following cards are supported:
- Latest Value – Displays the most recent Data Point
- Total Value – Dispalys the sum of all Data Points 
- Average – Displays the average value of all Data Points
- Count – Displays the count of all Data Points

![Card](./images/card.png)

### Properties Card
Properties Card visualizations are just like the vanilla Card visualizations except that they pull data from block properties on journal pages instead of from the `metrics-plugin-data` page that gets populated using **Metrics → Add** from the Command Palette.  The syntax for using Properties Cards is similar to the vanilla Card syntax although the visualiation name contains the `properties-` prefix.  For example, to display cards containing data from the `exercise-minutes::` block property, use the following syntax:
- `{{renderer :metrics, exercise-minutes, -, properties-latest}}` 
- `{{renderer :metrics, exercise-minutes, -, properties-sum}}` 
- `{{renderer :metrics, exercise-minutes, -, properties-average}}` 


### Bar Chart 
The bar chart is for comparing the total values of Child Metrics.  For example, a bar chart could be used to compare the number of exercise minutes of each type: running, cycling, cardio and stregnth training.  

![Bar Chart](./images/bar-chart.png)


### Line Chart
A line chart displays how a metric changes over time.  It comes in two forms: standard time series and cumulative time series.  The line chart can display multiple Child Metrics as different series on a single chart.  

![Line Chart](./images/line-chart.png)


## Syntax 

The visualization renderer has the following syntax:

`{{renderer :metrics, metric, child metric, visualization }}`

The `metric` and `child metric` arguments refer to the Metric and Child Metric whose value should be displayed in the visualization.  The Child Metric argument is optional: if no Child Metric is desired, use a single hyphen (`-`).  The `visualization` argument can one of the following values:
- `latest` – Card displaying the most rencent data point
- `sum` – Card displaying the sum of all data points
- `average` – Card displaying the average value of all Data Points 
- `bar` – Bar Chart displauing the total values of each Child Metric of the specified Metric
- `line` – Line Chart displaying a Metric's or Child Metric's value over time
- `cumulative-line` – Line Chart displaying the aggegate value of a Metric or Child Metrics over time

## Properties Charts
A Properties Chart visualizes how [Logseq properties](https://discuss.logseq.com/t/lesson-5-how-to-power-your-workflows-using-properties-and-dynamic-variables/10173#what-are-logseq-properties-1) in your journal change over time.  To use this chart type first enter some numberic properties on your journal pages.  In the example below, there are entries for the `weight::` property on three journal pages.

Both line charts and bar charts are supported.  Line charts use node properties from your journal pages to visualize time series data.  Bar charts enable grouping data into buckets of multiple days or a week to show the total or average values over each bucket.  The following visualizations are supported: 
- `properties-line` – Displays time series data in a line chart. 
- `properties-cumulative-line` – Displays time series data in a cumulative fashion in a line chart.
- `properties-bar` – Displays data in configurable time buckets in a bar chart. 

Example: use the **Metrics → Properties Line Chart** slash-command and enter the property name (`weight`) into the first argument of the renderer:
`{{renderer :metrics, weight, -, properties-line}}`. Or `{{renderer :metrics, weight, -, properties-cumulative-line}}` to aggegate property values over time.  The result looks like:

![PropertiesChart](./images/properties-chart.png)

Also several properties could be displayed on the same chart. Use a colon ":", a pipe "|" or a space " " to separate their names (! but NOT a comma ","): `{{renderer :metrics, weight | kcal, -, properties-line}}`.

If you need to display two completly different properties on the same chart: add a second y-axis by specifying asterisk `*` at the end of property name: `{{renderer :metrics, :weight :kcal*, -, properties-line}}`.

The date range for the properties chart can be customized by providing the start and end dates to the renderer as arguments in the format `YYYY-MM-DD`. For example, to limit the date range to March 1, 2023 through March 31, 2023, add the dates as arguments passed to the renderer like this: `{{renderer :metrics, weight, -, properties-line, 2023-03-01, 2023-03-31}}`.  You may also pass in a value that specifies a number of days in the form `-Xd`.  For example, passing `-12d` will be interepred as "twelve days ago".  Finally, you can pass in values of `today` and `yesterday` and they will be interpred appropriately.    

### Properties Bar Chart 
The syntax for the properties bar chart is: `{{renderer :metrics, [property], [title], properties-bar, [sum], [bucket size], [start date], [end date]}}`.  The arguments are:
- `property` – The name of the property or properties to display.  Multiple properties can be combined with a `|`.
- `title` – The title to display at the top of the chart, or `-` to show no title. 
- `sum` – Either `sum` or `average` to show either the sum or average of the values in the bucket
- `bucket size` – _(optional, default = 1)_ – The size of each bucket/grouping in days, or specify `week` to bucket by weeks starting on Sundays.  Bucketing by month is not yet supported – if you want this feature open an issue on Github and I'll implement it. 
- `start date` – _(optional, defaults all the earliest available data)_ – The start date of the data for the chart in `YYYY-MM-DD`, or relative days `-Xd`
- `end date` – _(optional, defaults to today's date)_ – The end date of the data for the chart in `YYYY-MM-DD`, or relative days `-Xd`

## Data Storage
Data for the metrics and data points is stored in the `metrics-plugin-data` page (could be changed in plugin settings).  Each Metric, Child Metric and Data Point is stored on individual blocks on this page.  For example, storage of a Metric called *Movies Watched* with Child Metrics for *Comedy*, *Drama* and *Horror* movies is stored as follows: 

- Movies Watched  
	- Comedy  
		- {"date":"2022-10-25T01:58:10.000Z","value":"5"}  
		- {"date":"2022-10-25T15:00:53.000Z","value":"1"}  
		- {"date":"2022-11-25T15:00:53.000Z","value":"1"}  
	- Drama  
		- {"date":"2022-10-25T01:58:23.000Z","value":"3"}  
		- {"date":"2022-09-25T01:58:23.000Z","value":"2"}  
	- Horror  
		- {"date":"2022-10-25T01:58:23.000Z","value":"3"}  
		- {"date":"2022-09-25T01:58:23.000Z","value":"2"}  

Data points are stored as JSON objects with two attributes:
- `date` – The date and time associated with the data point.  
- `value` – The value of the data point.  It can be an integer, float or string.  If storing non-numeric data as a string, the only visualization that will work is the Latest Card (for example, you can use this to display a Card showing the name of the last book you read.


## Configuration

Since v0.14 you no longer can set visualisation colors in plugin settings.  Now visualizations follows theme colors.  But if you want to return to old colors scheme add following lines to `... → Settings → Edit custom.css`:

```css
.dark-theme, html[data-theme=dark] {
  --metrics-bg-color1: #374151;
  --metrics-bg-color2: #1F2937;
  --metrics-border-color: #4f5e75;
  --metrics-text-color: #fff;
  --metrics-color1: #2A9D8F;
  --metrics-color2: #E9C46A;
  --metrics-color3: #F4A261;
  --metrics-color4: #E76F51;
  --metrics-color5: #264653;
}

.white-theme, html[data-theme=light] {
  --metrics-bg-color1: #F9FAFB;
  --metrics-bg-color2: #F3F4F6;
  --metrics-border-color: #ddd;
  --metrics-text-color: #111827;
  --metrics-color1: #2A9D8F;
  --metrics-color2: #E9C46A;
  --metrics-color3: #F4A261;
  --metrics-color4: #E76F51;
  --metrics-color5: #264653;
}
```


## Feedback 
I'd love to hear what you think of this plugin or if you have any suggestions for how to make it better!  Please [submit an issue](https://github.com/dangermccann/logseq-metrics/issues/new) on my Github to let share your feedback or to report bugs. 


<a href="https://www.buymeacoffee.com/dangermccaC" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a> 


> *“Measure what is measurable, and make measurable what is not so”* — Galileo Galilei 
