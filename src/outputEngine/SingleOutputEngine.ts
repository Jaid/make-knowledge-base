import type {ContentModule} from 'src/contentModule/ContentModule.js'

import {renderHandlebars} from 'zeug'

import {OutputEngine} from 'src/outputEngine/OutputEngine.js'

const template = /* handlebars */ `
<!DOCTYPE html>
<html lang=en>
  <body>
    {{#each pages}}
      <div>
        <h1>Knowledge Base: {{@key}}</h1>
        {{#each this}}
          {{#if title}}
            <h2>{{title}}</h2>
          {{else if entry.title}}
            <h2>{{entry.title}}</h2>
          {{/if}}
          {{renderContentModule this}}
        {{/each}}
      </div>
    {{/each}}
  </body>
</html>
`

export class SingleOutputEngine extends OutputEngine {
  async run() {
    const outputText = renderHandlebars(template, {
      pages: this.context.pages,
    }, {
      renderContentModule: (contentModule: ContentModule) => {
        return contentModule.asHtml()
      },
    })
    const outputFileStem = `${this.context.projectId}_knowledge_base`
    await this.outputHtmlFile(outputText, outputFileStem)
  }
}
