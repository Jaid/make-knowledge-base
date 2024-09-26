import showdown from 'showdown'

import {HtmlExtractor} from 'src/extractor/HtmlExtractor.js'
import {markdownToSimpleHtml} from 'src/lib/markdownToSimpleHtml.js'

export type ExtraOptions = {
}

export class HtmlFromMarkdownExtractor<ExtraOptionsGeneric = {}> extends HtmlExtractor<ExtraOptions & ExtraOptionsGeneric> {
  async init() {
    await super.init()
    const html = markdownToSimpleHtml(this.content, {
      headerLevelStart: 3,
    })
    this.content = html
  }
}
