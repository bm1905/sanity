import React from 'react'
import {Path} from '@sanity/util/lib/typedefs/path'
interface ChangeIndicatorContext {
  isChanged: boolean
  hasFocus: boolean
  path: Path
}

const initial: ChangeIndicatorContext = {isChanged: false, hasFocus: false, path: []}

export const FieldContext: React.Context<ChangeIndicatorContext> = React.createContext(initial)
