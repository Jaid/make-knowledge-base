import * as path from 'forward-slash-path'
import fs from 'fs-extra'

import {MarkdownContentModule} from 'src/make_knowledge_base/contentModule/MarkdownContentModule.js'
import {DownloadExtractor} from 'src/make_knowledge_base/extractor/DownloadExtractor.js'

export type ExtraOptions = {
}

export class WikimediaExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  getContentModule() {
    return new MarkdownContentModule(this.entry, this.content)
  }
  async init() {
    await super.init()
    const text = this.response.body
    const textFile = path.join(this.context.tempFolder, `download`, `mediawiki`, `${this.context.id}.txt`)
    await fs.outputFile(textFile, text)
    const $ = this.context.$({
      // @ts-expect-error
      stdout: `pipe`,
    })
    // @ts-expect-error
    const execa = await $({
      stdout: `pipe`,
    })`${this.context.options.pandocPath} --from mediawiki --to markdown --standalone --embed-resources --wrap none --no-highlight ${textFile}`
    this.content = execa.stdout
  }
}
