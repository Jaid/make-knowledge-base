import type {Dict} from 'more-types'
import type {ContentModule} from 'src/contentModule/ContentModule.js'
import type {RunSingleOptions} from 'src/run.js'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'

import * as ansi from 'lib/ansi.js'
import HtmlCompressor from 'lib/package/compress-for-llm/compressor/HtmlCompressor.js'

type Context = {
  options: RunSingleOptions
  outputFolder: string
  pages: Dict<Array<ContentModule>>
  projectId: string
}

export abstract class OutputEngine {
  context: Context
  constructor(context: Context) {
    this.context = context
  }
  async outputFile(outputText: string, outputFileStem: string) {
    const outputFile = path.join(this.context.outputFolder, 'dist', `${outputFileStem}.${this.context.options.outputFileExtension ?? 'html'}`)
    await fs.outputFile(outputFile, outputText)
    this.context.log(`→ ${await ansi.linkedFileWithSize(outputFile)}`)
  }
  async outputHtmlFile(outputText: string, outputFileStem: string) {
    let text = outputText
    if (this.context.options.minifyWholeDocument) {
      const htmlCompressor = new HtmlCompressor
      text = await htmlCompressor.compress(text)
    }
    await this.outputFile(text, outputFileStem)
  }
  // abstract run(): Promisable<void>
}
