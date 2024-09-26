import type {ContentModule} from 'src/contentModule/ContentModule.js'

import {renderHandlebars} from 'zeug'

import {OutputEngine} from 'src/outputEngine/OutputEngine.js'

const template = /* handlebars */ `
<!DOCTYPE html>
<html lang=en>
  <body>
    <h1>Knowledge Base</h1>
    <main>
      {{#each contentModules}}
        {{#if title}}
          <h2>{{title}}</h2>
        {{else if entry.title}}
          <h2>{{entry.title}}</h2>
        {{/if}}
        {{renderContentModule this}}
      {{/each}}
    </main>
  </body>
</html>
`

export class PagesOutputEngine extends OutputEngine {
  async run() {
    for (const [pageId, pageItems] of Object.entries(this.context.pages)) {
      const outputText = renderHandlebars(template, {
        contentModules: pageItems,
      }, {
        renderContentModule: (contentModule: ContentModule) => {
          return contentModule.asHtml()
        },
      })
      let outputFileStem = `${this.context.projectId}_knowledge`
      if (pageId) {
        outputFileStem += `_${pageId}`
      }
      await this.outputHtmlFile(outputText, outputFileStem)
    }
  }
}
