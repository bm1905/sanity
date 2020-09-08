import React from 'react'
import {ArrowHead, Direction} from './ArrowHead'

interface Bounds {
  height: number
  width: number
}

const moveTo = (from: number, to: number) => `M${from},${to}`
const lineTo = (from: number, to: number) => `L${from},${to}`

export interface Point {
  top: number
  left: number
}

// eslint-disable-next-line max-params
function quadraticBezierPath(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number
) {
  return `M${p1x},${p1y}Q${p2x},${p2y} ${p3x},${p3y}`
}

function line(p1x: number, p1y: number, p2x: number, p2y: number) {
  return `M${p1x},${p1y}L${p2x},${p2y}`
}

const blue = (opacity = 1) => `rgba(34, 118, 252, ${opacity})`
const BLUE = blue()

const clamp = (point: Point, bounds: Bounds) => {
  return {...point, top: Math.min(Math.max(0, point.top), bounds.height)}
}

function isNotNullable<T>(v: T | null): v is T {
  return Boolean(v)
}

const ARROW_THRESHOLD = 1
const ARROW_EDGE_DISTANCE = -4
function getArrow(
  point: Point,
  bounds: Bounds
): null | {point: Point; direction: Direction; color: string; opacity: number} {
  const distTop = point.top - ARROW_EDGE_DISTANCE
  if (distTop < ARROW_THRESHOLD) {
    return {
      point: clamp(point, bounds),
      direction: 'n',
      color: blue(),
      opacity: distTop < ARROW_EDGE_DISTANCE + 1 ? 1 : 0
      // color: blue(1 / Math.max(0, ARROW_THRESHOLD / -distTop))
    }
  }
  const distBottom = bounds.height - point.top - ARROW_EDGE_DISTANCE
  if (distBottom < ARROW_THRESHOLD) {
    return {
      point: clamp(point, bounds),
      direction: 's',
      // color: blue(1 / Math.max(0, ARROW_THRESHOLD / -distBottom))
      color: blue(),
      opacity: distBottom < ARROW_EDGE_DISTANCE + 1 ? 1 : 0
    }
  }
  return null
}

interface Props {
  from: Point
  to: Point
  bounds: Bounds
}

const STROKE_WIDTH = 2
const CORNER_RADIUS = 10
export function Connector(props: Props) {
  // todo: cleanup and remove repetition
  const from = props.from
  const to = props.to
  const vDist = to.top - from.top
  const halfWidth = (to.left - from.left) / 2

  const beginLine = line(
    from.left,
    from.top,
    Math.max(from.left, from.left + halfWidth - CORNER_RADIUS),
    from.top
  )
  const endLine = line(
    to.left,
    to.top,
    Math.min(to.left, to.left - halfWidth + CORNER_RADIUS),
    to.top
  )

  const beginArc = quadraticBezierPath(
    Math.max(from.left, from.left + halfWidth - CORNER_RADIUS),
    from.top,
    from.left + halfWidth,
    from.top,
    from.left + halfWidth,
    Math.max(from.top - CORNER_RADIUS, from.top + Math.min(vDist / 2, CORNER_RADIUS))
  )

  const endArc = quadraticBezierPath(
    Math.min(to.left, to.left - halfWidth + CORNER_RADIUS),
    to.top,
    to.left - halfWidth,
    to.top,
    to.left - halfWidth,
    Math.min(to.top + CORNER_RADIUS, to.top - Math.min(vDist / 2, CORNER_RADIUS))
  )

  const midLine = line(
    from.left + halfWidth,
    Math.max(from.top - CORNER_RADIUS, from.top + Math.min(vDist / 2, CORNER_RADIUS)),
    from.left + halfWidth,
    Math.min(to.top + CORNER_RADIUS, to.top - Math.min(vDist / 2, CORNER_RADIUS))
  )

  const arrows = [
    getArrow({top: from.top, left: from.left + halfWidth}, props.bounds),
    getArrow({top: to.top, left: from.left + halfWidth}, props.bounds)
  ]
  return (
    <>
      <path
        d={beginArc + beginLine + endArc + endLine + midLine}
        width={1}
        fill="none"
        stroke={BLUE}
        strokeWidth={STROKE_WIDTH}
      />

      {arrows.filter(isNotNullable).map((arrow, i) => (
        <ArrowHead
          key={i}
          size={10}
          strokeWidth={STROKE_WIDTH}
          top={arrow.point.top}
          left={arrow.point.left}
          direction={arrow.direction}
          color={arrow.color}
          opacity={arrow.opacity}
        />
      ))}
    </>
  )
}

export function Line({from, to, strokeWidth}: {from: Point; to: Point; strokeWidth: number}) {
  return (
    <path
      d={[moveTo(from.left, from.top), lineTo(to.left, to.top)].join('')}
      fill="none"
      stroke="gray"
      strokeWidth={strokeWidth}
    />
  )
}
