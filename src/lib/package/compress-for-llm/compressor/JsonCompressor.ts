import JSON5 from 'json5'

import Compressor from 'lib/package/compress-for-llm/compressor/Compressor.js'

type Options = {
  outputFormat?: `json` | `json5`
  parseErrorHandling?: `pass` | `throw`
}

export default class JsonCompressor<ExtraOptions = {}> extends Compressor<ExtraOptions & Options> {
  compress(code: string): string {
    try {
      const json = JSON5.parse(code)
      if (this.options.outputFormat === `json5`) {
        return JSON5.stringify(json)
      }
      return JSON.stringify(json)
    } catch (error) {
      if (this.options.parseErrorHandling === `throw`) {
        throw error
      }
      return code
    }
  }
  getDefaultOptions(): Partial<ExtraOptions & Options> {
    return {
      ...super.getDefaultOptions(),
      outputFormat: `json`,
      parseErrorHandling: `pass`,
    }
  }
}
