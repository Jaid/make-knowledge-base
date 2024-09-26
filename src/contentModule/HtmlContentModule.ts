import {ContentModule} from 'src/make_knowledge_base/contentModule/ContentModule.js'

export class HtmlContentModule extends ContentModule {
  asHtml(): string {
    return `<article id='${this.entry.id}'>\n${this.sourceText}\n</article>`
  }
}
