import {PagesOutputEngine} from 'src/make_knowledge_base/outputEngine/PagesOutputEngine.js'
import {SingleOutputEngine} from 'src/make_knowledge_base/outputEngine/SingleOutputEngine.js'

export const outputEngineTypes = {
  pages: PagesOutputEngine,
  single: SingleOutputEngine,
} as const
