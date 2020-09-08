import React from 'react'
import {Point} from './Connector'
import {lineTo, moveTo} from './svgHelpers'

export function Line({
  from,
  to,
  strokeWidth,
  color
}: {
  from: Point
  to: Point
  strokeWidth: number
  color: string
}) {
  return (
    <path
      d={[moveTo(from.left, from.top), lineTo(to.left, to.top)].join('')}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  )
}
