import test from 'node:test'

import makeCli from 'src/makeCli.js'

test(`run`, async () => {
  const cli = makeCli()
  await cli()
})
test(`show help`, async () => {
  const cli = makeCli()
  await cli(`--help`)
})
