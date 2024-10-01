import {MarkdownContentModule} from 'src/contentModule/MarkdownContentModule.js'
import {DownloadExtractor} from 'src/extractor/DownloadExtractor.js'

export type ExtraOptions = {
}

export class MarkdownExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  getContentModule() {
    return new MarkdownContentModule(this.entry, this.content)
  }
}
