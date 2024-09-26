import {PagesOutputEngine} from 'src/outputEngine/PagesOutputEngine.js'
import {SingleOutputEngine} from 'src/outputEngine/SingleOutputEngine.js'

export const outputEngineTypes = {
  pages: PagesOutputEngine,
  single: SingleOutputEngine,
} as const
