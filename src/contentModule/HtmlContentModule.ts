import {ContentModule} from 'src/contentModule/ContentModule.js'

export class HtmlContentModule extends ContentModule {
  asHtml(): string {
    return `<article id='${this.entry.id}'>\n${this.sourceText}\n</article>`
  }
  getFileExtension() {
    return 'html'
  }
}
