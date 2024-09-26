import TurndownService from 'turndown'

import {MarkdownContentModule} from 'src/contentModule/MarkdownContentModule.js'
import {HtmlExtractor} from 'src/extractor/HtmlExtractor.js'

export type ExtraOptions = {
}

export class MarkdownFromHtmlExtractor<ExtraOptionsGeneric = {}> extends HtmlExtractor<ExtraOptions & ExtraOptionsGeneric> {
  getContentModule() {
    return new MarkdownContentModule(this.entry, this.content)
  }
  async init() {
    await super.init()
    const html = this.content
    const turndownService = new TurndownService({
      codeBlockStyle: `fenced`,
    })
    this.content = turndownService.turndown(html)
  }
}
