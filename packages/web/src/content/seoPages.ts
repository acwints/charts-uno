export interface SeoFaq {
  q: string;
  a: string;
}

export interface SeoBlock {
  type: 'h2' | 'p' | 'ol' | 'ul' | 'pre' | 'faq';
  text?: string;
  items?: string[];
  faqs?: SeoFaq[];
}

export interface SeoSampleRow {
  label: string;
  value: number;
}

export interface SeoPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  sampleCaption: string;
  sample: SeoSampleRow[];
  blocks: SeoBlock[];
  ctaHref: string;
  ctaLabel: string;
}

const freeAccount =
  'You can paste data and preview a chart without an account and without paying. A free account saves up to 10 charts a month, and those saved charts can be exported as a PNG or CSV and shared with a link. Paid plans remove that monthly cap. There is no credit card for the free plan.';

const signupAnswer =
  'Not to paste data and see the chart. Saving to My Charts, downloading a PNG or CSV, and copying a share link need a free account. On the web, Continue with Google creates the account. The iOS app also offers Sign in with Apple.';

export const seoPages: SeoPage[] = [
  {
    slug: 'bar-chart-maker',
    title: 'Free Bar Chart Maker Online: Paste Data, Get a Chart | Chartsuno',
    description:
      'Paste numbers and preview a bar chart free in your browser. A free account saves it, exports a PNG, or shares a link. No spreadsheet required.',
    h1: 'Make a bar chart online, free',
    lede:
      'You have a handful of numbers and you need a bar chart: for a slide, a report, a post, or homework. You do not have to open a spreadsheet and fight the chart wizard. Paste your data and Chartsuno draws the chart in the browser.',
    sampleCaption: 'A bar chart from three rows. Longer bars are larger values.',
    sample: [
      { label: 'Apr', value: 120 },
      { label: 'May', value: 180 },
      { label: 'Jun', value: 360 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Paste your data.** Copy a table from a spreadsheet, a doc, or anywhere else. Two columns, labels and values, are enough. Chartsuno reads the table and builds the chart.',
          '**Fix anything in the data editor.** Change a value, rename a label, or add a row. The chart updates as you edit, so you do not rebuild it.',
          '**Tweak it in the chart editor.** Set the title, switch to horizontal bars when the names are long, and adjust the look.',
          '**Save, export, or share.** Previewing does not require an account. Sign in free to keep the chart in My Charts, download a PNG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'Why not just use a spreadsheet?' },
      {
        type: 'p',
        text: 'Spreadsheets are good at storing numbers. Making a chart that reads well is a separate chore: default colors, cramped labels, and axis settings buried in menus. Chartsuno starts from the chart. You paste data, and editing a number does not throw away the design.',
      },
      { type: 'h2', text: 'Good uses for a quick bar chart' },
      {
        type: 'ul',
        items: [
          'Comparing sales, signups, or survey answers across categories',
          'A ranking, such as a top 10, for a post or a newsletter',
          'Class or homework assignments that need a labeled graph',
          'One slide that sums up results for a meeting',
        ],
      },
      { type: 'h2', text: 'Tips for a bar chart people can read' },
      {
        type: 'ul',
        items: [
          'Sort the bars from largest to smallest unless the order means something, like months.',
          'Keep labels short. Chartsuno can switch a bar chart to horizontal bars when the category names are long.',
          'Use one color unless a color carries meaning.',
          'Put the takeaway in the title, for example “Q3 signups doubled”, not only “Signups”.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Can I edit the numbers after the chart is made?',
            a: 'Yes. Open the data editor, change any value or label, and the chart updates. Save the chart if you want the share link and My Charts to show the new numbers.',
          },
          {
            q: 'How do I get the chart into my slides?',
            a: 'Sign in, export a PNG, and drop it into PowerPoint, Keynote, Google Slides, or a doc. You can also copy a share link to the saved chart.',
          },
          {
            q: 'Does it work on my phone?',
            a: 'It runs in the browser, including mobile Safari. An iOS app is in App Review and is not on the App Store yet.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Make a free bar chart',
  },
  {
    slug: 'csv-to-chart',
    title: 'CSV to Chart: Turn a CSV File into a Chart Online | Chartsuno',
    description:
      'Turn a CSV into a chart in the browser. Paste the rows, edit any value, then save, export a PNG, or share a link with a free account.',
    h1: 'Turn a CSV into a chart',
    lede:
      'Exports from analytics, forms, and databases usually arrive as CSV. The usual next step is a spreadsheet: import, pick a range, insert a chart, then fix the formatting. Paste the CSV into Chartsuno and the chart is the starting point.',
    sampleCaption: 'Paste the header row. Chartsuno uses the first column as labels and the rest as series.',
    sample: [
      { label: 'Jan', value: 420 },
      { label: 'Feb', value: 510 },
      { label: 'Mar', value: 690 },
    ],
    blocks: [
      { type: 'h2', text: 'From CSV to chart' },
      {
        type: 'ol',
        items: [
          '**Paste the CSV or drop the file.** Include the header row. You can paste into the data box or upload a .csv file up to 10MB.',
          '**Check the data.** The data editor shows what was read. Fix a stray value, rename a column, or add rows on the same page.',
          '**Polish it.** Set the title and the chart type. Bar, line, and area charts are the usual fit for a tidy table.',
          '**Save, export, or share.** Download a PNG or the data back out as CSV, or copy a share link. Those actions need a free account. The chart stays in My Charts after you save it.',
        ],
      },
      { type: 'h2', text: 'What kind of CSV works best?' },
      {
        type: 'p',
        text: 'Chartsuno works best with a tidy table: a header row, one label column, and one or more number columns. Plain numbers are safest. If currency symbols or thousands separators read wrong, take them out or fix the cells in the data editor.',
      },
      {
        type: 'p',
        text: 'If the export has dozens of columns, paste just the ones you want to chart. Two or three series are usually easier to read than twelve.',
      },
      { type: 'h2', text: 'Example' },
      {
        type: 'pre',
        text: 'Month,Signups,Churned\nJan,420,38\nFeb,510,41\nMar,690,45',
      },
      {
        type: 'p',
        text: 'Paste that and you get a chart of signups against churn by month. Comma, tab, semicolon, and pipe-separated tables are detected. If an export still reads wrong, paste only the columns you need or fix the cells in the data editor.',
      },
      { type: 'h2', text: 'Why not open it in a spreadsheet?' },
      {
        type: 'p',
        text: 'You can. If all you want is the chart, a spreadsheet adds importing, delimiter choices, range selection, and then a pass to fix the default style. In Chartsuno you edit the data in place and the chart keeps its design.',
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is converting CSV to a chart free?', a: freeAccount },
          {
            q: 'Can I change the data after importing?',
            a: 'Yes. Every value and label can be edited in the data editor, and the chart updates. Save when you want My Charts and the share link to match.',
          },
          {
            q: 'Can I get my data back out?',
            a: 'Yes, once you are signed in. The export menu downloads the chart data as a CSV and the chart as a PNG.',
          },
          {
            q: 'What if my CSV uses semicolons or has extra columns?',
            a: 'Comma, tab, semicolon, and pipe-separated tables are detected. Paste only the columns you need if the file is wider than the chart should be, and fix anything that still looks wrong in the data editor.',
          },
          {
            q: 'Where are my charts saved?',
            a: 'In My Charts, after you sign in and save. You can reopen, edit, and export them later. A free account includes 10 saved charts a month.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Paste a CSV',
  },
  {
    slug: 'iphone-chart-maker',
    title: 'Chart Maker for iPhone: Make Charts from Your Data | Chartsuno',
    description:
      'Make charts on your iPhone in the browser. Paste data, edit with your thumb, then export or share. The iOS app is not on the App Store yet.',
    h1: 'A chart maker for your iPhone',
    lede:
      'Making a chart on a phone often means squinting at a spreadsheet, dragging selection handles, and hunting for the chart button. Chartsuno starts with the chart. Until the iOS app is on the App Store, open it in Safari.',
    sampleCaption: 'Short labels and a few bars stay readable on a phone screen.',
    sample: [
      { label: 'Mon', value: 2 },
      { label: 'Wed', value: 5 },
      { label: 'Fri', value: 4 },
    ],
    blocks: [
      { type: 'h2', text: 'What you can do on your phone today' },
      {
        type: 'ul',
        items: [
          '**Create a chart from data.** Paste a table you copied from Notes, Messages, Mail, or a spreadsheet.',
          '**Edit the data.** Change a number, rename a label, or add a row. The chart updates as you type.',
          '**Use the chart editor.** Set the title and adjust the look without a desktop.',
          '**Export and share, with a free account.** Download a PNG from Safari and save it to Photos, or copy a share link. Previewing a chart does not require an account.',
          '**Keep charts in My Charts.** Saved charts stay in one library, so you can open the same account on a laptop and keep editing.',
        ],
      },
      { type: 'h2', text: 'The iOS app is not live yet' },
      {
        type: 'p',
        text: 'The iOS app is in App Review and is not on the App Store yet. The button below opens the web app, which works in Safari on an iPhone. When the app is approved, this page can point at it. Until then, do not wait on the store.',
      },
      { type: 'h2', text: 'Made for on-the-go moments' },
      {
        type: 'ul',
        items: [
          'Posting a quick comparison',
          'Sending a chart to your team before a meeting',
          'Tracking personal numbers such as savings, workouts, or reading',
          'Finishing a school assignment away from a laptop',
        ],
      },
      { type: 'h2', text: 'Tips for a phone screen' },
      {
        type: 'ul',
        items: [
          'Put the one takeaway in the title.',
          'Fewer categories read better. Aim for under eight bars or slices.',
          'Short labels beat long ones. Abbreviate months and units.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          {
            q: 'Is Chartsuno available on iPhone?',
            a: 'The iOS app is in App Review and is not on the App Store yet. Chartsuno works today in Safari at chartsuno.com. This page sends you there.',
          },
          { q: 'Is it free?', a: freeAccount },
          {
            q: 'Can I start on my phone and finish on a laptop?',
            a: 'Yes, after you save. Charts live in My Charts on your account, so you can open them again on another browser and keep editing.',
          },
          {
            q: 'How do I share a chart from my phone?',
            a: 'Sign in, then download a PNG or copy a share link. A share link opens a read-only page with the chart title. Saving and sharing need a free account.',
          },
          {
            q: 'Do I need a spreadsheet first?',
            a: 'No. Paste or type your data straight into Chartsuno.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Open Chartsuno in your browser',
  },
  {
    slug: 'pie-chart-maker',
    title: 'Free Pie Chart Maker Online: Show a Split | Chartsuno',
    description:
      'Paste a few categories and preview a pie chart free in your browser. A free account saves it, exports a PNG, or shares a link. No spreadsheet required.',
    h1: 'Make a pie chart online, free',
    lede:
      'A pie chart answers one question: how is this whole divided? A budget, survey answers, traffic sources, or a vote. Paste the categories and the numbers, and Chartsuno draws the chart in the browser.',
    sampleCaption: 'Three parts of one whole. The same labels and values become the slices.',
    sample: [
      { label: 'Web', value: 62 },
      { label: 'Email', value: 24 },
      { label: 'Other', value: 14 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Paste the categories and the numbers.** Two columns are enough: a label and a value. Copy them from a note, a doc, or a spreadsheet.',
          '**Fix any cell in the data editor.** Change a value, rename a slice, or group a small category into Other. The chart updates as you edit.',
          '**Choose pie in the chart editor.** Set the title and keep the number of slices small enough to read on a slide or a phone.',
          '**Save, export, or share.** Previewing does not require an account. Sign in free to keep the chart in My Charts, download a PNG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'When a pie chart is the right chart' },
      {
        type: 'p',
        text: 'Use a pie when every value is a part of one total and you only have a few categories. If people need to compare numbers that are close together, a bar chart is easier to read. If the story is change over time, use a line graph instead.',
      },
      { type: 'h2', text: 'Tips for a pie people can read' },
      {
        type: 'ul',
        items: [
          'Aim for six slices or fewer. Roll the long tail into one Other slice.',
          'Put the largest slice first so the eye lands on the main share.',
          'Write the takeaway in the title, for example “Most traffic is direct”, not only “Traffic”.',
          'Skip the pie when the values are not parts of one whole.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Can I change the numbers after the pie is drawn?',
            a: 'Yes. Edit any label or value in the data editor and the slices update. Save the chart if you want My Charts and the share link to show the new numbers.',
          },
          {
            q: 'How do I put the pie in my slides?',
            a: 'Sign in, export a PNG, and drop it into PowerPoint, Keynote, Google Slides, or a doc. You can also copy a share link to the saved chart.',
          },
          {
            q: 'What if I have too many categories?',
            a: 'A pie with a dozen slices is hard to read. Keep the largest categories and combine the rest as Other, or switch the chart to bars.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Make a free pie chart',
  },
  {
    slug: 'line-graph-maker',
    title: 'Free Line Graph Maker Online: Plot a Trend | Chartsuno',
    description:
      'Paste dates and values and preview a line graph free in your browser. A free account saves the chart, exports a PNG, or shares a link.',
    h1: 'Make a line graph online, free',
    lede:
      'A line graph is for change: revenue by month, a temperature log, signups by week. Paste the dates and the numbers. Chartsuno draws the line in the browser so you can see the trend without building it inside a spreadsheet.',
    sampleCaption: 'A rising line. The first column is the time label, and the second is the value.',
    sample: [
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: 140 },
      { label: 'Mar', value: 190 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Paste the time column and the values.** Months, dates, or weeks in the first column. One or two number columns beside it.',
          '**Check the points in the data editor.** Fix a typo or add the missing month. The line updates as you edit, so you do not rebuild the graph.',
          '**Set the chart to a line.** Add a title that states the trend. A second series is fine when you are comparing two lines, and crowded when you add five.',
          '**Save, export, or share.** Previewing does not require an account. Sign in free to keep the graph, download a PNG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'Line graph or bar chart?' },
      {
        type: 'p',
        text: 'Use a line when the horizontal axis is time and the point is the slope. Use bars when the categories are separate things, such as products or cities, and connecting them with a line would invent a trend that is not there.',
      },
      { type: 'h2', text: 'Tips for a line that reads at a glance' },
      {
        type: 'ul',
        items: [
          'Keep the time steps even. A missing month looks like a flat stretch if you leave it out without saying so.',
          'Start the axis at zero unless a small change is the whole story, and then say so in the title.',
          'One or two lines. More than that, and the reader has to hunt for the series that matters.',
          'Put the conclusion in the title, for example “Signups rose every month”, not only “Signups”.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Can I plot more than one line?',
            a: 'Yes. Add another number column and Chartsuno draws another series. Two lines are usually enough. Name each series so the legend is readable.',
          },
          {
            q: 'Can I edit a point after the graph is made?',
            a: 'Yes. Change any value or label in the data editor and the line updates. Save when you want the share link and My Charts to match.',
          },
          {
            q: 'How do I share the graph?',
            a: 'Sign in, then download a PNG or copy a share link. Previewing the graph does not require an account. Saving and sharing need a free account.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Make a free line graph',
  },
  {
    slug: 'chart-from-google-sheets',
    title: 'Chart from Google Sheets: Paste a Range, Get a Chart | Chartsuno',
    description:
      'Copy a range from Google Sheets and turn it into a chart in the browser. Edit any cell, then save, export a PNG, or share a link with a free account.',
    h1: 'Make a chart from Google Sheets',
    lede:
      'Google Sheets can chart a range, but the result often needs a pass through menus before it is fit to share. If the chart is the point, copy the cells and paste them into Chartsuno. You do not connect your Google account. The sheet stays where it is.',
    sampleCaption: 'A header and three rows, the kind of range you copy out of a sheet.',
    sample: [
      { label: 'Q1', value: 40 },
      { label: 'Q2', value: 55 },
      { label: 'Q3', value: 48 },
    ],
    blocks: [
      { type: 'h2', text: 'From a sheet to a chart' },
      {
        type: 'ol',
        items: [
          '**Copy the range in Google Sheets.** Select the header row and the rows you want. Include the labels and the numbers. Leave the totals row out.',
          '**Paste into Chartsuno.** A copied sheet arrives as a table, the same way a CSV does. You can also paste into the data box or upload a CSV export of the sheet, up to 10MB.',
          '**Check the data editor.** Currency symbols, blank rows, and a stray total are easy to fix in place. The chart updates as you edit.',
          '**Choose the chart and share it.** Bar, line, and pie are the usual fits. Previewing does not require an account. Sign in free to save it, download a PNG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'What to copy' },
      {
        type: 'p',
        text: 'A tidy range works best: one header row, one label column, and one or more number columns. Copy just the columns the chart needs. Two or three series are easier to read than every tab in the workbook.',
      },
      {
        type: 'p',
        text: 'Chartsuno does not ask for access to Drive or to the spreadsheet. Paste is the whole connection. If the sheet is private, the chart still only contains the cells you copied.',
      },
      { type: 'h2', text: 'Example' },
      {
        type: 'pre',
        text: 'Quarter,Revenue,Costs\nQ1,40,22\nQ2,55,24\nQ3,48,21',
      },
      {
        type: 'p',
        text: 'Paste that, or the same cells copied from a sheet, and you get revenue against costs by quarter. Comma, tab, semicolon, and pipe-separated tables are detected. If a cell splits wrong, fix it in the data editor.',
      },
      { type: 'h2', text: 'Why not use the chart inside the sheet?' },
      {
        type: 'p',
        text: 'The sheet chart is attached to the grid: default colors, a legend that collides with the plot, and an export that is a screenshot of the tab. Chartsuno starts from the chart. Editing a number does not throw away the design, and a share link shows the chart without handing someone the rest of the spreadsheet.',
      },
      {
        type: 'faq',
        faqs: [
          {
            q: 'Do I have to connect my Google account?',
            a: 'No. Copy the cells and paste them. Chartsuno does not request access to Google Drive or to the spreadsheet.',
          },
          { q: 'Is it free?', a: freeAccount },
          {
            q: 'Can I edit the data after pasting?',
            a: 'Yes. Every label and value can be changed in the data editor, and the chart updates. The original sheet is not modified.',
          },
          {
            q: 'What if my sheet uses a totals row or extra columns?',
            a: 'Leave the totals row out of the copy, and copy only the columns you want on the chart. Anything that still looks wrong can be fixed in the data editor.',
          },
          {
            q: 'Where is the chart saved?',
            a: 'In My Charts, after you sign in and save. You can reopen, edit, and export it later. A free account includes 10 saved charts a month.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Paste a Google Sheet',
  },
  {
    slug: 'scatter-plot-maker',
    title: 'Free Scatter Plot Maker Online: Plot Two Number Columns | Chartsuno',
    description:
      'Paste two number columns and preview a scatter plot free in your browser. A free account saves it, exports PNG or SVG, or shares a link.',
    h1: 'Make a scatter plot online, free',
    lede:
      'A scatter plot is for a relationship between two numbers: hours studied and a score, ad spend and signups, price and units sold. Paste the pairs. Chartsuno draws the points in the browser.',
    sampleCaption: 'Each row is one point. On this page the bar stands in for the second number. In the app, choose Scatter and the same rows become points.',
    sample: [
      { label: '2', value: 4 },
      { label: '5', value: 7 },
      { label: '8', value: 6 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Paste two number columns.** The first column is the horizontal position. The second is the vertical position. A header row is fine.',
          '**Check the points in the data editor.** Fix a typo or drop a row that is not part of the comparison. The chart updates as you edit.',
          '**Choose Scatter in the chart editor.** Set a title that states the relationship you are looking at. A line chart would connect the points and invent an order they may not have.',
          '**Save, export, or share.** Previewing does not require an account. Sign in free to keep the plot in My Charts, download a PNG or SVG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'Scatter plot, line graph, or bar chart?' },
      {
        type: 'p',
        text: 'Use a scatter plot when both axes are measurements and the question is whether they move together. Use a line graph when the horizontal axis is time and the point is the slope. Use bars when the labels are categories, such as products or cities, and connecting them would not mean anything.',
      },
      { type: 'h2', text: 'Tips for a scatter plot people can read' },
      {
        type: 'ul',
        items: [
          'Name both axes. “Score” and “Hours” beat an unlabeled cloud of points.',
          'Put the takeaway in the title, for example “Scores rise with study time”, if the points actually show that.',
          'One series is enough unless a second group is the comparison. A dozen overlapping series is a mess.',
          'If a point is a typo, fix it in the data editor instead of stretching the axis around it.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Can I plot more than one series?',
            a: 'Yes. Add another number column and Chartsuno can draw another series. Two groups are usually the limit of what a scatter plot can show clearly.',
          },
          {
            q: 'Can I change a point after the plot is drawn?',
            a: 'Yes. Edit any value in the data editor and the point moves. Save the chart if you want My Charts and the share link to match.',
          },
          {
            q: 'How do I get the plot into my slides?',
            a: 'Sign in, then download a PNG or SVG. You can also copy a share link to the saved chart. Previewing does not require an account.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Make a free scatter plot',
  },
  {
    slug: 'chart-from-excel',
    title: 'Chart from Excel: Paste Cells, Get a Chart | Chartsuno',
    description:
      'Copy a range from Excel and turn it into a chart in the browser. Chartsuno does not open .xlsx files. Paste the cells, or upload a CSV, then export or share with a free account.',
    h1: 'Make a chart from Excel',
    lede:
      'Excel can chart a range, and then you spend the next ten minutes on the default colors and a legend that covers the plot. If the chart is the point, copy the cells and paste them into Chartsuno. The workbook stays where it is.',
    sampleCaption: 'A header and three rows, the kind of range you copy out of a worksheet.',
    sample: [
      { label: 'North', value: 42 },
      { label: 'South', value: 31 },
      { label: 'West', value: 55 },
    ],
    blocks: [
      { type: 'h2', text: 'From a worksheet to a chart' },
      {
        type: 'ol',
        items: [
          '**Copy the range in Excel.** Select the header row and the rows you want. Include the labels and the numbers. Leave the totals row out. Excel puts a tab-separated table on the clipboard.',
          '**Paste into Chartsuno.** A copied range arrives as a table. Chartsuno also accepts a .csv file up to 10MB. It does not open .xlsx or .xls workbooks. If you would rather upload, use Save As and choose CSV.',
          '**Check the data editor.** Currency symbols, blank rows, and a stray total are easy to fix in place. The chart updates as you edit, and the original workbook is not changed.',
          '**Choose the chart and share it.** Bar, line, scatter, and pie are the usual fits. Previewing does not require an account. Sign in free to save it, download a PNG or SVG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'What to copy' },
      {
        type: 'p',
        text: 'A tidy range works best: one header row, one label column, and one or more number columns. Copy just the columns the chart needs. Two or three series are easier to read than every column in the sheet.',
      },
      {
        type: 'p',
        text: 'Chartsuno does not ask for access to the workbook or to OneDrive. Paste is the whole connection. If the file is private, the chart still only contains the cells you copied.',
      },
      { type: 'h2', text: 'Example' },
      {
        type: 'pre',
        text: 'Region,Orders,Returns\nNorth,42,3\nSouth,31,2\nWest,55,4',
      },
      {
        type: 'p',
        text: 'Paste that, or the same cells copied from Excel, and you get orders against returns by region. Comma, tab, semicolon, and pipe-separated tables are detected. A copied Excel range is usually tabs. If a cell splits wrong, fix it in the data editor.',
      },
      { type: 'h2', text: 'Why not use the chart inside Excel?' },
      {
        type: 'p',
        text: 'The Excel chart is attached to the grid: default colors, a legend that collides with the plot, and an export that is often a screenshot of the sheet. Chartsuno starts from the chart. Editing a number does not throw away the design, and a share link shows the chart without handing someone the rest of the workbook.',
      },
      {
        type: 'faq',
        faqs: [
          {
            q: 'Can I upload an .xlsx file?',
            a: 'No. Copy the cells and paste them, or save the sheet as CSV and upload that .csv file, up to 10MB. Chartsuno does not open Excel workbooks directly.',
          },
          { q: 'Is it free?', a: freeAccount },
          {
            q: 'Will pasting change my spreadsheet?',
            a: 'No. Chartsuno only receives the cells you copied. The workbook is not opened and is not modified.',
          },
          {
            q: 'What if my sheet uses a totals row or extra columns?',
            a: 'Leave the totals row out of the copy, and copy only the columns you want on the chart. Anything that still looks wrong can be fixed in the data editor.',
          },
          {
            q: 'Where is the chart saved?',
            a: 'In My Charts, after you sign in and save. You can reopen, edit, and export it later. A free account includes 10 saved charts a month.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Paste an Excel range',
  },
  {
    slug: 'chartsuno-vs-datawrapper',
    title: 'Chartsuno vs Datawrapper: Paste a Table or Publish an Embed | Chartsuno',
    description:
      'An honest comparison. Datawrapper is built for interactive newsroom embeds. Chartsuno turns a pasted table into a chart you can edit and download. Free limits differ.',
    h1: 'Chartsuno and Datawrapper, compared',
    lede:
      'Both tools make a chart from a table. They are not the same job. Datawrapper is how newsrooms publish interactive graphics. Chartsuno is for pasting the numbers you already have and leaving with a chart you can edit.',
    sampleCaption: 'A small table you could paste into either tool. The notes below are about the product around the chart, not a score for this data.',
    sample: [
      { label: 'Q1', value: 18 },
      { label: 'Q2', value: 24 },
      { label: 'Q3', value: 21 },
    ],
    blocks: [
      { type: 'h2', text: 'What each one is for' },
      {
        type: 'p',
        text: 'Datawrapper is a publishing tool. Its free plan, as listed on datawrapper.de/pricing in November 2026, lets you create, publish, and embed interactive charts, maps, and tables, and download a PNG. The free plan keeps a “Created with Datawrapper” attribution. SVG and PDF downloads, and removing that attribution, are listed on the Pro plan at $21 per user each month, excluding VAT.',
      },
      {
        type: 'p',
        text: 'Chartsuno starts in the browser from pasted cells. You can preview a chart without an account and without paying. A free account saves up to 10 charts a month. Those saved charts can be downloaded as a PNG, an SVG, or a CSV, and shared with a link. Paid plans remove that monthly cap. There is no credit card for the free plan.',
      },
      { type: 'h2', text: 'Where Datawrapper is the better fit' },
      {
        type: 'ul',
        items: [
          'You are embedding an interactive chart, map, or table in an article and you want it to stay online as a published graphic.',
          'You need the locator maps, symbol maps, and choropleth maps Datawrapper is known for. Chartsuno is not a map newsroom.',
          'You want unlimited free publishing. Datawrapper’s pricing page says the free plan does not cap how many graphics you create or how many people view them. Chartsuno’s free account stops at 10 saved charts a month.',
          'Your organization already has a Datawrapper theme, team workspace, or style guide.',
        ],
      },
      { type: 'h2', text: 'Where Chartsuno is the better fit' },
      {
        type: 'ul',
        items: [
          'The numbers are in Excel, Google Sheets, or a CSV, and you want the chart without connecting the spreadsheet or uploading a workbook. Copy the cells and paste them. Chartsuno does not open .xlsx files.',
          'You want to fix a number in a data editor and see the chart update, instead of rebuilding it.',
          'You want a PNG or SVG download on the free account. On Datawrapper’s published pricing, SVG and PDF downloads are part of Pro. Chartsuno does not export PDF.',
          'You want a read-only share link to one chart, not a public embed in a CMS. Previewing the chart does not require an account.',
        ],
      },
      { type: 'h2', text: 'What this page will not claim' },
      {
        type: 'p',
        text: 'Chartsuno does not have Datawrapper’s chart catalog, its responsive article embeds, or its newsroom maps. A Chartsuno share page is a read-only view of one saved chart, and downloads carry a small “Made with Chartsuno” credit. Datawrapper’s free graphics carry their own attribution, which their paid plans can remove. Pick the tool whose output you actually need.',
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is Chartsuno free?', a: freeAccount },
          {
            q: 'Does Datawrapper have a free plan?',
            a: 'Yes. Their pricing page says the free plan can create, publish, and embed charts, maps, and tables, and download PNG, with a Created with Datawrapper line. It does not describe a limit on how many graphics you publish. SVG and PDF downloads are listed on Pro, at $21 per user each month, excluding VAT, as of November 2026. Check datawrapper.de/pricing before you rely on a price.',
          },
          {
            q: 'Is Chartsuno a replacement for Datawrapper?',
            a: 'Not if you publish interactive graphics in articles. It is a fit when you have a table and you want to edit it and download or share the chart. The free account is 10 saved charts a month, which is smaller than Datawrapper’s free publishing.',
          },
          {
            q: 'Do I have to connect Google or Excel?',
            a: 'No. Copy the cells and paste them, or upload a CSV up to 10MB. Chartsuno does not request access to the spreadsheet, and it does not open .xlsx files.',
          },
          {
            q: 'Can I try a chart before I make an account?',
            a: 'Yes. Pasting data and previewing the chart works without an account. Saving, downloading, and copying a share link need a free account.',
          },
        ],
      },
    ],
    ctaHref: '/',
    ctaLabel: 'Paste your data into Chartsuno',
  },
  {
    slug: 'area-chart-maker',
    title: 'Free Area Chart Maker Online: Show a Total Over Time | Chartsuno',
    description:
      'Paste months and values and preview an area chart free in your browser. A free account saves it, exports a PNG or SVG, or shares a link.',
    h1: 'Make an area chart online, free',
    lede:
      'An area chart is a line with the space underneath filled in. Use it when the size of the total matters as much as the slope: revenue by month, a running balance, or two series that add up. Paste the table and Chartsuno fills the area in the browser.',
    sampleCaption: 'A rising total. The filled area is the point, not only the line along the top.',
    sample: [
      { label: 'Jan', value: 12 },
      { label: 'Feb', value: 18 },
      { label: 'Mar', value: 27 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Paste the time column and the values.** Months, weeks, or dates in the first column. One number column is a single area. Two number columns can be compared, or stacked so each band is a part of the total.',
          '**Fix a point in the data editor.** Change a value or add the missing month. The filled area updates as you edit, so you do not rebuild the chart.',
          '**Choose Area in the chart editor.** Set a title that states the total. Turn on Stacked when the series are parts of one whole. Leave it off when each series should be read on its own.',
          '**Save, export, or share.** Previewing does not require an account. Sign up free to keep the chart in My Charts, download a PNG or SVG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'Area chart, line graph, or stacked bars?' },
      {
        type: 'p',
        text: 'Use an area when the horizontal axis is time and the filled shape should show how large the total is. Use a line graph when the slope is the whole story and a fill would exaggerate it. Use stacked bars when the categories are separate periods you want to compare as columns, not as one continuous shape.',
      },
      { type: 'h2', text: 'Tips for an area people can read' },
      {
        type: 'ul',
        items: [
          'Start the value axis at zero. An area that floats above zero makes a small change look like a large mass.',
          'Two series is usually the limit. A stack of five translucent bands is hard to trace.',
          'Keep the time steps even. A missing month looks like the total paused.',
          'Put the conclusion in the title, for example “Cash on hand grew every month”, not only “Balance”.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Can I stack two areas?',
            a: 'Yes. Paste two number columns, choose Area, and turn on Stacked. Each band is then a part of the total. Leave Stacked off if the series should overlap instead of add.',
          },
          {
            q: 'Can I edit a value after the area is drawn?',
            a: 'Yes. Change any label or number in the data editor and the fill updates. Save the chart if you want My Charts and the share link to match.',
          },
          {
            q: 'How do I put the chart in a slide?',
            a: 'Sign up, then download a PNG or SVG. You can also copy a share link to the saved chart. Previewing the area does not require an account.',
          },
        ],
      },
    ],
    ctaHref: '/?auth=1',
    ctaLabel: 'Sign up and make an area chart',
  },
  {
    slug: 'histogram-maker',
    title: 'Free Histogram Maker Online: Chart a Distribution | Chartsuno',
    description:
      'Paste bin labels and counts and preview a histogram free in your browser. A free account saves it, exports a PNG or SVG, or shares a link.',
    h1: 'Make a histogram online, free',
    lede:
      'A histogram shows how a set of numbers is spread: how many orders fell in each dollar range, how many scores landed in each band. Paste the bins and the counts. Chartsuno draws the bars touching, which is what makes it a histogram instead of a category bar chart.',
    sampleCaption: 'Each label is a bin you already grouped. The bar is how many observations fell in that bin.',
    sample: [
      { label: '0-9', value: 4 },
      { label: '10-19', value: 11 },
      { label: '20-29', value: 7 },
    ],
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'ol',
        items: [
          '**Group the raw numbers into bins first.** Chartsuno does not auto-bin a list of individual measurements. Count how many values fall in each range, then paste one row per bin: the range as the label, the count as the value.',
          '**Check the counts in the data editor.** Fix a tally or rename a bin. The bars update as you edit.',
          '**Choose Histogram in the chart editor.** The bars sit against each other, with no gap, so the shape of the distribution reads as one sequence. A normal bar chart leaves a gap because the categories are separate things.',
          '**Save, export, or share.** Previewing does not require an account. Sign up free to keep the histogram in My Charts, download a PNG or SVG, or copy a share link. A free account includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'Example' },
      {
        type: 'pre',
        text: 'Bin,Orders\n0-9,4\n10-19,11\n20-29,7',
      },
      {
        type: 'p',
        text: 'Paste that and choose Histogram. You get three touching bars. If you still have the raw order amounts, tally them into bins in a note or a spreadsheet first, then paste only the summary.',
      },
      { type: 'h2', text: 'Histogram or bar chart?' },
      {
        type: 'p',
        text: 'Use a histogram when the labels are adjacent ranges of one measurement and the question is the shape: where the values bunch, and where they thin out. Use a bar chart when the labels are categories, such as products or cities. Those bars should have a gap, because there is no sequence between them.',
      },
      { type: 'h2', text: 'Tips for a histogram people can read' },
      {
        type: 'ul',
        items: [
          'Keep the bins the same width. A bin of 0-9 next to a bin of 10-100 hides the shape.',
          'Put the bins in order, left to right, from the smallest range to the largest.',
          'Name the axis. “Orders” and “Order value ($)” beat an unlabeled row of bars.',
          'Write the shape in the title, for example “Most orders are $10 to $19”, if that is what the counts show.',
        ],
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is it free?', a: freeAccount },
          { q: 'Do I need to sign up?', a: signupAnswer },
          {
            q: 'Will Chartsuno bin my raw numbers for me?',
            a: 'No. Paste the bins and the counts. If you have a list of individual measurements, group them into equal-width ranges first, then chart the counts.',
          },
          {
            q: 'Can I change a count after the histogram is drawn?',
            a: 'Yes. Edit any bin label or count in the data editor and the bar updates. Save when you want My Charts and the share link to match.',
          },
          {
            q: 'How do I share the histogram?',
            a: 'Sign up, then download a PNG or SVG, or copy a share link. Previewing does not require an account. Saving and sharing need a free account.',
          },
        ],
      },
    ],
    ctaHref: '/?auth=1',
    ctaLabel: 'Sign up and make a histogram',
  },
  {
    slug: 'chartsuno-vs-canva-charts',
    title: 'Chartsuno vs Canva Charts: A Chart, or a Chart Inside a Design | Chartsuno',
    description:
      'An honest comparison. Canva puts a chart inside a design. Chartsuno turns a pasted table into a chart you can edit, download, and share. Free limits differ.',
    h1: 'Chartsuno and Canva Charts, compared',
    lede:
      'Both can draw a bar from a table. They are not the same job. Canva is a design editor, and a chart is one object on a poster, a slide, or a social post. Chartsuno starts from the numbers and leaves you with a chart you can edit.',
    sampleCaption: 'A small sales table you could paste into either tool. The notes below are about the product around the chart, not a score for this data.',
    sample: [
      { label: 'Apr', value: 18 },
      { label: 'May', value: 22 },
      { label: 'Jun', value: 19 },
    ],
    blocks: [
      { type: 'h2', text: 'What each one is for' },
      {
        type: 'p',
        text: 'Canva’s help center describes 30+ chart types, including bar, line, area, pie, donut, scatter, and histogram, inside the design editor. You can type the numbers, or import a CSV, TSV, or XLSX file. Their import article says a file can be up to 25MB, and up to 1,000 rows and 100 columns. A chart connected to a Canva Sheet in the same design updates with that sheet. Third-party data apps, such as Google Analytics or HubSpot, are listed as Canva Business and Canva Enterprise, not Canva Free. Canva’s pricing page lists Free at US$0 and Pro at US$120 a year for one person, as of November 2026. Check canva.com/pricing and canva.com/help/import-to-charts before you rely on a price or a limit.',
      },
      {
        type: 'p',
        text: 'Chartsuno starts in the browser from pasted cells. You can preview a chart without an account and without paying. A free account saves up to 10 charts a month. Those saved charts can be downloaded as a PNG, an SVG, or a CSV, and shared with a link. Paid plans remove that monthly cap. There is no credit card for the free plan. A CSV upload is capped at 10MB. Chartsuno does not open .xlsx files.',
      },
      { type: 'h2', text: 'Where Canva is the better fit' },
      {
        type: 'ul',
        items: [
          'The chart is one piece of a poster, a slide deck, or a social post, and you want templates, photos, and brand colors around it.',
          'You need a chart type Chartsuno does not offer, such as a funnel, a hierarchy, a bubble plot, or a pictogram.',
          'You want to upload an .xlsx file directly. Canva’s import help says CSV, TSV, and XLSX are accepted. Chartsuno takes a paste or a .csv file, not an Excel workbook.',
          'The chart should stay linked to a Canva Sheet in the same design, so edits in the sheet show up on the design without a second paste.',
        ],
      },
      { type: 'h2', text: 'Where Chartsuno is the better fit' },
      {
        type: 'ul',
        items: [
          'You have a table in Excel, Google Sheets, or a CSV and you want the chart, not a designed page. Copy the cells and paste them. Chartsuno does not ask for access to the spreadsheet.',
          'You want to fix a number in a data editor and see the chart update, then download a PNG or SVG on the free account.',
          'You want a read-only share link to one chart. A Canva share is a design. A Chartsuno share page is the chart, with its title, and a small Made with Chartsuno credit.',
          'You want to try the chart before you make an account. Pasting and previewing work without signing up. Saving, downloading, and the share link need a free account, which includes 10 saved charts a month.',
        ],
      },
      { type: 'h2', text: 'What this page will not claim' },
      {
        type: 'p',
        text: 'Chartsuno is not a design suite. It does not have Canva’s template library, photo library, or brand kits. Canva is the better tool when the chart has to live on a designed page. Chartsuno is the better tool when the table is the job and you want to edit it and leave with the chart. Pick the one whose output you actually need.',
      },
      {
        type: 'faq',
        faqs: [
          { q: 'Is Chartsuno free?', a: freeAccount },
          {
            q: 'Does Canva have a free plan?',
            a: 'Yes. Canva’s pricing page lists Free at US$0, with a drag-and-drop editor, and Pro at US$120 a year for one person, as of November 2026. Their help says third-party data apps for charts are on Canva Business and Enterprise, not Free. You can still type data or upload a CSV, TSV, or XLSX file. Check canva.com/pricing before you rely on a price.',
          },
          {
            q: 'Is Chartsuno a replacement for Canva?',
            a: 'Not if you are designing a post, a deck, or a poster. It is a fit when you have a table and you want to edit it and download or share the chart. The free account is 10 saved charts a month.',
          },
          {
            q: 'Can I upload an Excel file?',
            a: 'Not an .xlsx workbook. Copy the cells and paste them, or save the sheet as CSV and upload that .csv file, up to 10MB. Canva’s import help says it accepts XLSX.',
          },
          {
            q: 'Can I try a chart before I sign up?',
            a: 'Yes. Pasting data and previewing the chart works without an account. Saving, downloading, and copying a share link need a free account.',
          },
        ],
      },
    ],
    ctaHref: '/?auth=1',
    ctaLabel: 'Sign up and paste your data',
  },
];

export function seoPageBySlug(slug: string): SeoPage | undefined {
  return seoPages.find((page) => page.slug === slug);
}

export const SEO_ORIGIN = 'https://www.chartsuno.com';
