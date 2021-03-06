// Helper method for describing a blockContentType's feature set
export default function blockContentFeatures(blockContentType) {
  if (!blockContentType) {
    throw new Error("Parameter 'blockContentType' required")
  }
  const blockType = blockContentType.of.find(findBlockType)
  if (!blockType) {
    throw new Error("'block' type is not defined in this schema (required).")
  }
  const ofType = blockType.fields.find(field => field.name === 'children').type.of
  const spanType = ofType.find(memberType => memberType.name === 'span')
  const inlineObjectTypes = ofType.filter(memberType => memberType.name !== 'span')
  const blockObjectTypes = blockContentType.of.filter(field => field.name !== blockType.name)
  return {
    styles: resolveEnabledStyles(blockType),
    decorators: resolveEnabledDecorators(spanType),
    annotations: resolveEnabledAnnotationTypes(spanType),
    lists: resolveEnabledListItems(blockType),
    types: {
      block: blockContentType,
      span: spanType,
      inlineObjects: inlineObjectTypes,
      blockObjects: blockObjectTypes
    }
  }
}

function resolveEnabledStyles(blockType) {
  const styleField = blockType.fields.find(btField => btField.name === 'style')
  if (!styleField) {
    throw new Error("A field with name 'style' is not defined in the block type (required).")
  }
  const textStyles =
    styleField.type.options.list && styleField.type.options.list.filter(style => style.value)
  if (!textStyles || textStyles.length === 0) {
    throw new Error(
      'The style fields need at least one style ' +
        "defined. I.e: {title: 'Normal', value: 'normal'}."
    )
  }
  return textStyles
}

function resolveEnabledAnnotationTypes(spanType) {
  return spanType.annotations.map(annotation => {
    return {
      blockEditor: annotation.blockEditor,
      title: annotation.title,
      type: annotation,
      value: annotation.name,
      icon: annotation.icon
    }
  })
}

function resolveEnabledDecorators(spanType) {
  return spanType.decorators
}

function resolveEnabledListItems(blockType) {
  const listField = blockType.fields.find(btField => btField.name === 'list')
  if (!listField) {
    throw new Error("A field with name 'list' is not defined in the block type (required).")
  }
  const listItems =
    listField.type.options.list && listField.type.options.list.filter(list => list.value)
  if (!listItems) {
    throw new Error('The list field need at least to be an empty array')
  }
  return listItems
}

function findBlockType(type) {
  if (type.type) {
    return findBlockType(type.type)
  }

  if (type.name === 'block') {
    return type
  }

  return null
}
