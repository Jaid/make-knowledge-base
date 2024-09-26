import type {SecondParameter} from 'more-types'

import {minify} from 'html-minifier'

import TextCompressor from 'lib/package/compress-for-llm/compressor/TextCompressor.js'

type HtmlMinifierConfig = NonNullable<SecondParameter<typeof minify>>

export type Options = {
  minifierConfig: HtmlMinifierConfig | `basic` | `strong`
}

const basicConfig = {
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  collapseWhitespace: true,
  conservativeCollapse: true,
  continueOnParseError: true,
  decodeEntities: true,
  keepClosingSlash: true,
  quoteCharacter: `'`,
  removeComments: true,
  removeRedundantAttributes: true,
  sortAttributes: true,
  sortClassName: true,
  removeEmptyAttributes: true,
} as HtmlMinifierConfig
const strongConfig = {
  ...basicConfig,
  keepClosingSlash: false,
  removeAttributeQuotes: true,
  removeEmptyElements: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  collapseBooleanAttributes: true,
} as HtmlMinifierConfig
const defaultOptions: Options = {
  minifierConfig: `strong`,
}

export const minifyHtml = (html: string, options: HtmlCompressor[`options`]) => {
  let config = options.minifierConfig
  if (typeof config === `string`) {
    if (config === `strong`) {
      config = strongConfig
    } else {
      config = basicConfig
    }
  }
  return minify(html, config)
}

export default class HtmlCompressor<ExtraOptions = {}> extends TextCompressor<ExtraOptions & Options> {
  compress(code: string) {
    try {
      code = minifyHtml(code, this.options)
    } catch (error) {
      console.error({error})
    }
    code = super.compress(code)
    return code
  }
  getDefaultOptions(): Partial<ExtraOptions & Options> {
    return {
      ...super.getDefaultOptions(),
      ...defaultOptions,
    }
  }
}

if (import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  const compressor = new HtmlCompressor
  const htmlCode = `
    <html>
      <head>
        <Title>Example</Title >
      </head>
      <body>
        <h1> Hello World </h1>
        <p> This is an example. </p>
      </body>
    </html>
  `
  const result = await compressor.compress(htmlCode)
  console.dir({result})
}
