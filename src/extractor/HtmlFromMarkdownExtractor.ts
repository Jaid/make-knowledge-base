import showdown from 'showdown'

import {HtmlExtractor} from 'src/make_knowledge_base/extractor/HtmlExtractor.js'
import {markdownToSimpleHtml} from 'src/make_knowledge_base/lib/markdownToSimpleHtml.js'

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
