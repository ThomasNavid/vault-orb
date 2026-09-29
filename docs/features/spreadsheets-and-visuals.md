# Spreadsheets and visuals

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Privacy](../privacy.md)

Inspect spreadsheet data stored in the vault and ask Orb to show a sourced table or chart. Orb can also extract comparisons and numeric observations from ordinary notes.

## Setup

Put a supported `.xlsx`, `.csv`, or `.tsv` file inside the selected vault. No external spreadsheet account is needed. Each file must be at most **20 MB**. Workbooks are inspected for sheet names before a bounded range is read.

The starter includes no datasets or finance features. The examples below assume you provide a small CSV at `Data/Measurements.csv` with date and measurement columns, or substitute your own file and units.

## Things to ask

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Find Data/Measurements.csv and show its data.” | Reads the file's stored rows and presents them. | No |
| “Chart the measurements in Data/Measurements.csv in the recorded units.” | A sourced trend chart with unit labels and View data. | No |
| “Read A1:B7 of Data/Measurements.csv and compare the first and last measurements.” | Reads that exact range, then explains the change. | No |
| “Show that comparison as a bar chart.” | A bar chart using the previously read values. | No |
| “Compare the options in Notes/Example launch options.md in a table.” | A non-numeric comparison sourced from a note. | No |
| “Close the chart.” | Dismisses the companion visual. | No |

For your own workbook, replace the illustrative filename/sheet with real ones:

> “Which sheets are in Data/Measurements.xlsx?”
>
> “Read A1:D25 from the Monthly sheet in Data/Measurements.xlsx and chart the monthly actuals in the recorded units.”
>
> “Are these values cached formula results? Explain any missing values before comparing them.”

The starter does not include Measurements.xlsx; those examples require you to supply it. Use a range containing labels as well as the values you want compared.

## What happens

For Excel, Orb first sees sheet names and dimensions, then reads the selected range. Each range can contain at most **4,000 cells**. CSV/TSV reads return stored strings, so units and date interpretation need to come from the source or your request.

Visuals support tables and line, area, or bar charts. Charts include source links, units, hover/focus values, and a View data table. Missing numeric observations remain missing rather than becoming zero. Sources can identify a workbook sheet/range.

When a question involves at least two comparable sourced numbers, Orb is instructed to show a chart proactively if it helps, even if you did not explicitly say “chart”. For a single number, it can answer plainly. You can always explicitly ask for a supported visual.

Task lists, goal cards, and calendars are built directly from tool results. General charts and comparison tables are model-supplied data validated for shape and source access. That validation does not prove every interpretation or calculation; inspect the linked source and View data for important decisions.

## Walkthrough using the sample data

1. **“Read A1:B7 of Data/Measurements.csv.”** Expect a header and six monthly measurements.
2. **“Chart those measurements over time in the recorded units.”** Expect January through June in chronological order.
3. **“How much did the balance change from January to June?”** The fictional source has GBP 3,200 and GBP 5,650, a difference of GBP 2,450.
4. Use **View data** to inspect the plotted values, then click the source to open the CSV in your default local application.

The source file remains unchanged throughout.

## Limits

- Spreadsheet access is **read-only**. Orb does not edit cells, save workbooks, run macros, or recalculate formulas.
- Excel formula values come from saved cached results and may be stale or missing. Recalculate and save in your spreadsheet application if current formula results matter.
- Supported formats are `.xlsx`, `.csv`, and `.tsv`; legacy `.xls`, PDF tables, and image OCR are not supported.
- Charts support up to **four series** and **150 points**. Model-generated tables support **eight columns** and **200 rows**. Ask for a focused range or comparison when larger.
- Pie charts, maps, dashboards, chart file export, and spreadsheet generation are not implemented.
- Orb has no general Python/SQL execution tool; analysis is performed from the retrieved data through model reasoning and the supported visual tools. It is not a replacement for a calculation engine on complex numerical work.

## Troubleshooting

**File or sheet not found:** ask for filename matches or workbook sheet names first; then use the exact path/name.

**Range too large:** request a smaller A1 range, such as A1:D100, with at most 4,000 cells. Files over 20 MB must be reduced outside Orb.

**A chart has gaps:** inspect the original cells; blank or missing values are intentionally not replaced with zero.

**Unexpected totals or dates:** inspect View data, specify the currency/units, and check cached formulas and CSV formats in the source app.

Implementation: [spreadsheet.cjs](../../src/spreadsheet.cjs), [visuals.cjs](../../src/visuals.cjs), [spreadsheet tests](../../test/spreadsheet.test.cjs), and [visual tests](../../test/visuals.test.cjs).
