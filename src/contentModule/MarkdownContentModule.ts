import {ContentModule} from 'src/contentModule/ContentModule.js'

export class MarkdownContentModule extends ContentModule {
  asHtml(): string {
    return `<article class='markdown' id='${this.entry.id}'><pre>\n${this.sourceText}\n</pre></article>`
  }
  getFileExtension() {
    return 'md'
  }
}
