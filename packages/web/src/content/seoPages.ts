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
];

export function seoPageBySlug(slug: string): SeoPage | undefined {
  return seoPages.find((page) => page.slug === slug);
}

export const SEO_ORIGIN = 'https://www.chartsuno.com';
