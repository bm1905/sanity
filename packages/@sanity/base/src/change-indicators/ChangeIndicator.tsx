import React from 'react'
import {FieldContext} from './FieldContext'
import * as PathUtils from '@sanity/util/paths'
import {Reporter} from './elementTracker'

export function ChangeIndicator(props: {children?: React.ReactNode}) {
  const context = React.useContext(FieldContext)
  return context.isChanged ? (
    <Reporter
      id={`field-${PathUtils.toString(context.path)}`}
      component="div"
      data={{children: props.children}}
    />
  ) : (
    props.children || null
  )
}
