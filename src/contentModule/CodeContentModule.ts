import {ContentModule} from 'src/contentModule/ContentModule.js'

export class CodeContentModule extends ContentModule {
  asHtml(): string {
    return `<div id='${this.entry.id}'><pre><code>\n${this.sourceText}\n</code></pre></div>`
  }
}
