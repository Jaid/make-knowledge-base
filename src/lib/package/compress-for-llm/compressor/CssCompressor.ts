import type {SecondParameter} from 'more-types'

import cssnano from 'cssnano'
import postcss from 'postcss'

import TextCompressor from 'lib/package/compress-for-llm/compressor/TextCompressor.js'

export type Options = {
  cssnanoConfig: NonNullable<SecondParameter<typeof cssnano>>
}

const defaultOptions: Options = {
  cssnanoConfig: {
    preset: `default`,
  },
}

export const minifyCss = async (css: string, options: CssCompressor[`options`]) => {
  const processor = postcss([cssnano(options.cssnanoConfig)])
  const result = await processor.process(css, {
    from: undefined,
  })
  return result.css
}

export default class CssCompressor<ExtraOptions = {}> extends TextCompressor<ExtraOptions & Options> {
  async compress(code: string) {
    const minified = await minifyCss(code, this.options)
    const cleaned = await super.compress(minified)
    return cleaned
  }
  getDefaultOptions(): Partial<ExtraOptions & Options> {
    return {
      ...super.getDefaultOptions(),
      ...defaultOptions,
    }
  }
}

if (import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  const compressor = new CssCompressor
  const cssCode = `
    body {
      margin: 0;
      padding: 0;
    }
    h1 {
      color: #333333;
    }
  `
  const result = await compressor.compress(cssCode)
  console.dir({result})
}
