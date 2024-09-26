import {MarkdownContentModule} from 'src/make_knowledge_base/contentModule/MarkdownContentModule.js'
import {DownloadExtractor} from 'src/make_knowledge_base/extractor/DownloadExtractor.js'

export type ExtraOptions = {
}

export class MarkdownExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  getContentModule() {
    return new MarkdownContentModule(this.entry, this.content)
  }
  async init() {
    await super.init()
    this.content = this.response.body
  }
}
