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
];

export function seoPageBySlug(slug: string): SeoPage | undefined {
  return seoPages.find((page) => page.slug === slug);
}

export const SEO_ORIGIN = 'https://www.chartsuno.com';
