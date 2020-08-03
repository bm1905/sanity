/* eslint-disable @typescript-eslint/explicit-function-return-type */

import React from 'react'
import {Subscription} from 'rxjs'
import {isActionEnabled} from 'part:@sanity/base/util/document-action-utils'
import Button from 'part:@sanity/components/buttons/default'
import schema from 'part:@sanity/base/schema'
import afterEditorComponents from 'all:part:@sanity/desk-tool/after-editor-component'
import filterFieldFn$ from 'part:@sanity/desk-tool/filter-fields-fn?'
import EditForm from './EditForm'
import HistoryForm from './HistoryForm'
import {Doc} from '../types'

import styles from './FormView.css'

interface Props {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patchChannel?: any
  value: Doc | null
  initialValue: Doc
  isConnected: boolean
  showHistoric: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (patches: any[]) => void
  schemaType: {name: string; title: string}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markers: Array<{path: any[]}>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}

const noop = () => undefined

const INITIAL_STATE = {
  focusPath: [],
  filterField: () => true
}

export default class FormView extends React.PureComponent<Props> {
  static defaultProps = {
    markers: [],
    isConnected: true
  }

  state = INITIAL_STATE

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterFieldFnSubscription: Subscription | null = null

  componentDidMount() {
    if (filterFieldFn$) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.filterFieldFnSubscription = filterFieldFn$.subscribe((filterField: any) =>
        this.setState({filterField})
      )
    }
  }

  componentWillUnmount() {
    if (this.filterFieldFnSubscription) {
      this.filterFieldFnSubscription.unsubscribe()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleFocus = (path: any[]) => {
    this.setState({focusPath: path})
  }

  handleBlur = () => {
    // do nothing
  }

  handleEditAsActualType = () => {
    // TODO
  }

  isReadOnly() {
    const {value, schemaType, isConnected} = this.props
    const isNonExistent = !value || !value._id

    return (
      !isConnected ||
      !isActionEnabled(schemaType, 'update') ||
      (isNonExistent && !isActionEnabled(schemaType, 'create'))
    )
  }

  render() {
    const {
      id,
      value,
      initialValue,
      showHistoric,
      markers,
      patchChannel,
      schemaType,
    } = this.props
    const {focusPath, filterField} = this.state
    const readOnly = this.isReadOnly()
    const documentId = value && value._id && value._id.replace(/^drafts\./, '')

    const hasTypeMismatch = value && value._type && value._type !== schemaType.name
    if (hasTypeMismatch) {
      return (
        <div className={styles.typeMisMatchMessage}>
          This document is of type <code>{value!._type}</code> and cannot be edited as{' '}
          <code>{schemaType.name}</code>
          <div>
            <Button onClick={this.handleEditAsActualType}>Edit as {value!._type} instead</Button>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.root}>
        {showHistoric ? (
          <HistoryForm document={value} schema={schema} schemaType={schemaType} />
        ) : (
          <EditForm
            id={id}
            value={value || initialValue}
            filterField={filterField}
            focusPath={focusPath}
            markers={markers}
            onBlur={this.handleBlur}
            onChange={readOnly ? noop : this.props.onChange}
            onFocus={this.handleFocus}
            patchChannel={patchChannel}
            readOnly={readOnly}
            schema={schema}
            type={schemaType}
          />
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {afterEditorComponents.map((AfterEditorComponent: any, idx: number) => (
          <AfterEditorComponent key={String(idx)} documentId={documentId} />
        ))}
      </div>
    )
  }
}