# Carbon Trigger Browser Extension: 

Using the India Energy Maps API to track electricity usage, build a browser extension so that you can have a reminder right in your browser about how heavy your zone's electricity usage is. Using this extension ad hoc will help you to make judgement calls on your activities based on this information.

## Getting Started

You will need to have [npm](https://npmjs.com) installed. Download a copy of this code to a folder on your computer.

Install all the required packages:

```
npm install
```

Build the extension from webpack

```
npm run build
```

To install on Edge, use the 'three dot' menu on the top right corner of the browser to find the Extensions panel. From there, select 'Load Unpacked' to load a new extension. Open the `dist` folder at the prompt and the extension will load. To use it, you will need an India Energy Maps API key and one of these zones: `northern`, `western`, `southern`, `eastern`, or `north-eastern`.

Carbon intensity requests use `hours=0&factors=lifecycle`, so they return the latest hourly value including upstream and combustion emissions.

Once the API key and region is input into the extension interface, the colored dot in the browser extension bar should change to reflect your region's energy usage and give you a pointer on what energy-heavy activities would be appropriate for you to perform. The concept behind this 'dot' system was given to me by the [Energy Lollipop extension](https://energylollipop.com/) for California emissions.

