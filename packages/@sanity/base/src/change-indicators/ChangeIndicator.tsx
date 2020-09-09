import React from 'react'
import {FieldContext} from './FieldContext'
import {Reporter} from './elementTracker'

export function ChangeIndicator(props: {children?: React.ReactNode}) {
  const context = React.useContext(FieldContext)
  return context.isChanged && context.hasFocus ? (
    <Reporter
      id={`changed-field`}
      component="div"
      data={{path: context.path, children: props.children}}
    />
  ) : (
    props.children || null
  )
}
