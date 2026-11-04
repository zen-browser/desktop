#!/usr/bin/env swift
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Options:
//   --out <dir>       write the SVGs somewhere else (default: this directory)
//   --weight <name>   override the symbol weight for every icon
//   --nucleo <dir>    Nucleo directory used to verify the map is complete
//   --verbose         print the mismatch of every icon, not only the outliers
//   --only <file>     generate only this icon (repeatable)
//   --dump <dir>      write the official and reconstructed rasters as PNGs
//   --boldness <n>    override the extra thickness (see `boldness`)

import AppKit
import Foundation

// MARK: - Configuration

let defaultWeight = "medium"
var boldness = 0.0
let referenceSymbol = "gearshape"
let referenceExtent = 16.0
let maximumExtent = 16.0
let samplePointSize = 100.0
let rasterScale = 4.0
let outlineUnitsPerPoint = 2.0
let mismatchWarning = 0.1

let weights: [String: NSFont.Weight] = [
  "ultralight": .ultraLight,
  "thin": .thin,
  "light": .light,
  "regular": .regular,
  "medium": .medium,
  "semibold": .semibold,
  "bold": .bold,
  "heavy": .heavy,
  "black": .black,
]

let fileHeader = """
  #filter dumbComments emptyLines substitution
  # This Source Code Form is subject to the terms of the Mozilla Public
  # License, v. 2.0. If a copy of the MPL was not distributed with this
  # file, You can obtain one at http://mozilla.org/MPL/2.0/.

  """

// MARK: - Arguments

let scriptDir = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
var outDir = scriptDir
var weightOverride: String?
var nucleoDir = scriptDir.appendingPathComponent("../nucleo")
var verbose = false
var only = Set<String>()
var dumpDir: URL?

var args = Array(CommandLine.arguments.dropFirst())
while !args.isEmpty {
  let flag = args.removeFirst()
  switch flag {
  case "--out":
    outDir = URL(fileURLWithPath: args.removeFirst())
  case "--weight":
    weightOverride = args.removeFirst()
  case "--nucleo":
    nucleoDir = URL(fileURLWithPath: args.removeFirst())
  case "--verbose":
    verbose = true
  case "--only":
    only.insert(args.removeFirst())
  case "--dump":
    dumpDir = URL(fileURLWithPath: args.removeFirst())
  case "--boldness":
    boldness = Double(args.removeFirst()) ?? boldness
  default:
    fail("unknown argument \(flag)")
  }
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("error: \(message)\n".data(using: .utf8)!)
  exit(1)
}

func warn(_ message: String) {
  FileHandle.standardError.write("warning: \(message)\n".data(using: .utf8)!)
}

// MARK: - Symbol map

struct Entry {
  let file: String
  let symbol: String?
  let custom: Bool
  let viewBox: Double
  let weight: String
  let scale: Double
  let stretch: Double
  let like: String?
}

func loadEntries() -> [Entry] {
  let mapURL = scriptDir.appendingPathComponent("symbols.json")
  guard let data = try? Data(contentsOf: mapURL),
    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  else {
    fail("cannot read \(mapURL.path)")
  }
  return json.keys.sorted().compactMap { file in
    if file.hasPrefix("_") { return nil }
    let value = json[file]
    if value is NSNull {
      return Entry(
        file: file, symbol: nil, custom: false, viewBox: 18, weight: defaultWeight, scale: 1,
        stretch: 1, like: nil)
    }
    if let symbol = value as? String {
      return Entry(
        file: file, symbol: symbol == "custom" ? nil : symbol, custom: symbol == "custom",
        viewBox: 18, weight: defaultWeight, scale: 1, stretch: 1, like: nil)
    }
    guard let options = value as? [String: Any], let symbol = options["symbol"] as? String else {
      fail("\(file): expected a symbol name, an object with a \"symbol\" key, or null")
    }
    return Entry(
      file: file,
      symbol: symbol,
      custom: false,
      viewBox: options["viewBox"] as? Double ?? 18,
      weight: options["weight"] as? String ?? defaultWeight,
      scale: options["scale"] as? Double ?? 1,
      stretch: options["stretch"] as? Double ?? 1,
      like: options["like"] as? String
    )
  }
}

// MARK: - Symbol access

struct Symbol {
  let outline: NSBezierPath
  let image: NSImage
  let layers: [Layer]?
}

struct Layer {
  let index: Int
  let position: Int
  let erases: Bool
  let hidden: Bool
  let subpaths: Int
}

dlopen("/System/Library/PrivateFrameworks/CoreSVG.framework/CoreSVG", RTLD_NOW)
typealias SVGWriteFunction = @convention(c) (AnyObject?, CFMutableData, CFDictionary?) -> Void
let svgWrite: SVGWriteFunction? = {
  guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGSVGDocumentWriteToData")
  else { return nil }
  return unsafeBitCast(symbol, to: SVGWriteFunction.self)
}()

func attribute(_ name: String, in tag: String) -> String? {
  guard let range = tag.range(of: " \(name)=\"") else { return nil }
  let rest = tag[range.upperBound...]
  guard let end = rest.firstIndex(of: "\"") else { return nil }
  return String(rest[..<end])
}

func matches(_ pattern: String, in text: String) -> [[String]] {
  let regex = try! NSRegularExpression(pattern: pattern)
  return regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).map { match in
    (0..<match.numberOfRanges).map { String(text[Range(match.range(at: $0), in: text)!]) }
  }
}

func layerStructure(of rep: NSImageRep) -> [Layer]? {
  guard let write = svgWrite,
    let glyph = rep.value(forKey: "vectorGlyph") as? NSObject,
    let rendition = glyph.value(forKey: "_rendition") as? NSObject
  else { return nil }
  let selector = NSSelectorFromString("svgDocument")
  guard rendition.responds(to: selector),
    let document = rendition.perform(selector)?.takeUnretainedValue()
  else { return nil }
  let data = CFDataCreateMutable(nil, 0)!
  write(document, data, nil)
  guard let text = String(data: data as Data, encoding: .utf8) else { return nil }

  var erases = [Int: Bool]()
  for match in matches("\\.monochrome-(\\d+)\\{([^}]*)\\}", in: text) {
    erases[Int(match[1])!] =
      match[2].contains("clear-behind:true") && match[2].contains("opacity:0.0")
  }
  var layers: [Layer] = []
  for (position, match) in matches("<path\\b[^>]*>", in: text).enumerated() {
    guard let classes = attribute("class", in: match[0]), let d = attribute("d", in: match[0])
    else { continue }
    let contours = d.filter { $0 == "M" || $0 == "m" }.count
    let hidden = attribute("opacity", in: match[0]).flatMap(Double.init) == 0
    for name in classes.split(separator: " ") where name.hasPrefix("monochrome-") {
      guard let index = Int(name.dropFirst("monochrome-".count)) else { continue }
      layers.append(
        Layer(
          index: index, position: position, erases: erases[index] ?? false, hidden: hidden,
          subpaths: contours))
    }
  }
  if layers.isEmpty { return nil }
  return layers.sorted { ($0.index, $0.position) < ($1.index, $1.position) }
}

func roles(from layers: [Layer], count: Int) -> (erasers: Set<Int>, hidden: Set<Int>)? {
  var erasers = Set<Int>()
  var hidden = Set<Int>()
  var next = 0
  for layer in layers {
    let range = next..<(next + layer.subpaths)
    if layer.hidden && layer.erases {
      erasers.formUnion(range)
    } else if layer.hidden {
      hidden.formUnion(range)
    }
    next += layer.subpaths
  }
  return next == count ? (erasers, hidden) : nil
}

func symbolWeight(_ name: String) -> NSFont.Weight {
  if let weight = weights[name] { return weight }
  if let value = Double(name) { return NSFont.Weight(rawValue: value) }
  fail("unknown weight \(name)")
}

func loadSymbol(_ name: String, weight weightName: String) -> Symbol? {
  let weight = symbolWeight(weightName)
  guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil) else {
    return nil
  }
  let configuration = NSImage.SymbolConfiguration(
    pointSize: samplePointSize, weight: weight, scale: .medium)
  guard let configured = image.withSymbolConfiguration(configuration),
    let rep = configured.representations.first
  else { return nil }
  let selector = NSSelectorFromString("outlinePath")
  guard rep.responds(to: selector),
    let outline = rep.perform(selector)?.takeUnretainedValue() as? NSBezierPath
  else { return nil }
  return Symbol(outline: outline, image: configured, layers: layerStructure(of: rep))
}

func nucleoExtent(_ file: String, viewBox: Double) -> Double? {
  let url = nucleoDir.appendingPathComponent(file)
  guard var text = try? String(contentsOf: url, encoding: .utf8) else { return nil }
  text = text.split(separator: "\n", omittingEmptySubsequences: false)
    .filter { !$0.hasPrefix("#") }.joined(separator: "\n")
    .replacingOccurrences(of: "context-fill-opacity", with: "1")
    .replacingOccurrences(of: "context-fill", with: "#000")
  guard let data = text.data(using: .utf8), let image = NSImage(data: data),
    image.size.width > 0, image.size.height > 0
  else { return nil }
  let raster = officialRaster(image)
  let ink = raster.inkBounds
  guard ink.width > 0 else { return nil }
  let extent = max(ink.width, ink.height) / rasterScale
  let box = max(image.size.width, image.size.height)
  return min(extent * viewBox / box, viewBox / 18 * maximumExtent)
}

// MARK: - Geometry

struct Subpath {
  let path: CGPath
  let area: Double
}

func subpaths(of outline: NSBezierPath) -> [Subpath] {
  var result: [Subpath] = []
  var current: CGMutablePath?
  var polygon: [CGPoint] = []

  func flush() {
    guard let path = current, !polygon.isEmpty else { return }
    path.closeSubpath()
    var area = 0.0
    for i in 0..<polygon.count {
      let p = polygon[i]
      let q = polygon[(i + 1) % polygon.count]
      area += p.x * q.y - q.x * p.y
    }
    result.append(Subpath(path: path, area: area / 2))
    current = nil
    polygon = []
  }

  var points = [NSPoint](repeating: .zero, count: 3)
  for index in 0..<outline.elementCount {
    switch outline.element(at: index, associatedPoints: &points) {
    case .moveTo:
      flush()
      current = CGMutablePath()
      current!.move(to: points[0])
      polygon = [points[0]]
    case .lineTo:
      current?.addLine(to: points[0])
      polygon.append(points[0])
    case .curveTo:
      current?.addCurve(to: points[2], control1: points[0], control2: points[1])
      polygon.append(points[2])
    case .closePath:
      flush()
    default:
      current?.addQuadCurve(to: points[1], control: points[0])
      polygon.append(points[1])
    }
  }
  flush()
  return result
}

// MARK: - Rasters

struct Raster {
  let width: Int
  let height: Int
  let alpha: [UInt8]

  func inked(_ x: Int, _ y: Int) -> Bool {
    guard x >= 0, y >= 0, x < width, y < height else { return false }
    return alpha[y * width + x] >= 128
  }

  /// Centre of mass of the inked pixels.
  var centroid: CGPoint {
    var sumX = 0.0, sumY = 0.0, count = 0.0
    for y in 0..<height {
      for x in 0..<width where inked(x, y) {
        sumX += Double(x)
        sumY += Double(y)
        count += 1
      }
    }
    return count == 0 ? .zero : CGPoint(x: sumX / count, y: sumY / count)
  }

  /// Bounding box of the inked pixels.
  var inkBounds: CGRect {
    var minX = width, minY = height, maxX = -1, maxY = -1
    for y in 0..<height {
      for x in 0..<width where inked(x, y) {
        minX = min(minX, x)
        maxX = max(maxX, x)
        minY = min(minY, y)
        maxY = max(maxY, y)
      }
    }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
  }
}

/// Rasterises the official symbol image. Row 0 is the top row.
func officialRaster(_ image: NSImage) -> Raster {
  let width = Int((image.size.width * rasterScale).rounded(.up))
  let height = Int((image.size.height * rasterScale).rounded(.up))
  guard
    let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8,
      samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
      bytesPerRow: 0, bitsPerPixel: 0)
  else { fail("cannot create bitmap") }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(x: 0, y: 0, width: width, height: height))
  NSGraphicsContext.restoreGraphicsState()
  var alpha = [UInt8](repeating: 0, count: width * height)
  let data = rep.bitmapData!
  for y in 0..<height {
    for x in 0..<width {
      alpha[y * width + x] = data[y * rep.bytesPerRow + x * 4 + 3]
    }
  }
  return Raster(width: width, height: height, alpha: alpha)
}

func candidateRaster(
  _ parts: [Subpath], erasers: Set<Int>, hidden: Set<Int>, fillRule: CGPathFillRule,
  transform: CGAffineTransform, width: Int, height: Int
) -> Raster {
  guard
    let context = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.alphaOnly.rawValue)
  else { fail("cannot create context") }
  context.translateBy(x: 0, y: CGFloat(height))
  context.scaleBy(x: 1, y: -1)
  context.concatenate(transform)
  context.setFillColor(CGColor(gray: 0, alpha: 1))

  var pending = CGMutablePath()
  func flushPending() {
    if !pending.isEmpty {
      context.addPath(pending)
      context.fillPath(using: fillRule)
      pending = CGMutablePath()
    }
  }
  for (index, part) in parts.enumerated() where !hidden.contains(index) {
    if erasers.contains(index) {
      flushPending()
      context.setBlendMode(.clear)
      context.addPath(part.path)
      context.fillPath()
      context.setBlendMode(.normal)
    } else {
      pending.addPath(part.path)
    }
  }
  flushPending()

  let data = context.data!.assumingMemoryBound(to: UInt8.self)
  var alpha = [UInt8](repeating: 0, count: width * height)
  for y in 0..<height {
    for x in 0..<width {
      alpha[y * width + x] = data[y * context.bytesPerRow + x]
    }
  }
  return Raster(width: width, height: height, alpha: alpha)
}

func writePNG(_ raster: Raster, to url: URL) {
  guard
    let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: raster.width, pixelsHigh: raster.height, bitsPerSample: 8,
      samplesPerPixel: 1, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceWhite,
      bytesPerRow: 0, bitsPerPixel: 0)
  else { return }
  let data = rep.bitmapData!
  for y in 0..<raster.height {
    for x in 0..<raster.width {
      data[y * rep.bytesPerRow + x] = 255 - raster.alpha[y * raster.width + x]
    }
  }
  try? rep.representation(using: .png, properties: [:])?.write(to: url)
}

/// Share of pixels that are inked in only one of the two rasters.
func mismatch(_ a: Raster, _ b: Raster) -> Double {
  var differing = 0
  var inked = 0
  for i in 0..<a.alpha.count {
    let x = a.alpha[i] >= 128
    let y = b.alpha[i] >= 128
    if x || y { inked += 1 }
    if x != y { differing += 1 }
  }
  return inked == 0 ? 0 : Double(differing) / Double(inked)
}

// MARK: - Classification

struct Interpretation {
  let source: String
  let fillRule: CGPathFillRule
  let erasers: Set<Int>
  let hidden: Set<Int>
  let mismatch: Double
  let raster: Raster
}

func classify(_ parts: [Subpath], transform: CGAffineTransform, official: Raster) -> [Bool] {
  var transform = transform
  let inset = 2.0  // pixels away from the contour, to stay clear of anti-aliasing
  let paths = parts.map { $0.path.copy(using: &transform)! }
  let boxes = paths.map { $0.boundingBoxOfPath }
  var additive: [Bool] = []
  for (index, path) in paths.enumerated() {
    let box = boxes[index]
    let overlapping = paths.indices.filter { $0 != index && !boxes[$0].contains(box) }
    let steps = 24
    var inkedExclusive = 0
    var exclusive = 0
    var inkedAll = 0
    var all = 0
    for i in 0...steps {
      for j in 0...steps {
        let p = CGPoint(
          x: box.minX + box.width * Double(i) / Double(steps),
          y: box.minY + box.height * Double(j) / Double(steps))
        let neighbours = [
          CGPoint(x: p.x - inset, y: p.y), CGPoint(x: p.x + inset, y: p.y),
          CGPoint(x: p.x, y: p.y - inset), CGPoint(x: p.x, y: p.y + inset),
        ]
        guard path.contains(p, using: .evenOdd),
          neighbours.allSatisfy({ path.contains($0, using: .evenOdd) })
        else { continue }
        let inked = official.inked(Int(p.x), Int(p.y))
        all += 1
        if inked { inkedAll += 1 }
        let covered = overlapping.contains { paths[$0].contains(p, using: .evenOdd) }
        if !covered {
          exclusive += 1
          if inked { inkedExclusive += 1 }
        }
      }
    }
    if exclusive >= 10 {
      additive.append(inkedExclusive * 2 >= exclusive)
    } else {
      additive.append(all == 0 || inkedAll * 2 >= all)
    }
  }
  return additive
}

func erasers(in parts: [Subpath], additive: [Bool]) -> Set<Int> {
  var positive = 0.0
  var negative = 0.0
  for (index, part) in parts.enumerated() where additive[index] {
    if part.area >= 0 { positive += part.area } else { negative -= part.area }
  }
  let additiveSign: Double = positive >= negative ? 1 : -1
  var result = Set<Int>()
  for (index, part) in parts.enumerated()
  where !additive[index] && (part.area >= 0 ? 1.0 : -1.0) == additiveSign {
    result.insert(index)
  }
  return result
}

func interpret(_ parts: [Subpath], symbol: Symbol, official: Raster) -> Interpretation {
  var candidates: [(String, CGPathFillRule, Set<Int>, Set<Int>)] = []
  if let layers = symbol.layers {
    let orders = [
      ("layers", layers),
      ("document order", layers.sorted { ($0.position, $0.index) < ($1.position, $1.index) }),
    ]
    for (name, ordered) in orders {
      guard let roles = roles(from: ordered, count: parts.count) else { continue }
      for (hiddenName, hidden) in [("", roles.hidden), (", visible", Set<Int>())] {
        if hiddenName == ", visible" && roles.hidden.isEmpty { continue }
        for (ruleName, rule) in [("", CGPathFillRule.winding), (", evenodd", CGPathFillRule.evenOdd)] {
          let label = name + hiddenName + ruleName
          if candidates.contains(where: { $0.1 == rule && $0.2 == roles.erasers && $0.3 == hidden }) {
            continue
          }
          candidates.append((label, rule, roles.erasers, hidden))
        }
      }
    }
  }

  let scale = rasterScale / outlineUnitsPerPoint
  let bounds = symbol.outline.bounds
  let ink = official.inkBounds
  let initial = CGPoint(x: ink.midX - bounds.midX * scale, y: ink.midY - bounds.midY * scale)
  func transform(_ offset: CGPoint) -> CGAffineTransform {
    CGAffineTransform(translationX: offset.x, y: offset.y).scaledBy(x: scale, y: scale)
  }
  func registered(_ erased: Set<Int>, _ hidden: Set<Int>, _ rule: CGPathFillRule) -> Raster {
    var offset = initial
    var raster: Raster
    var attempts = 0
    repeat {
      raster = candidateRaster(
        parts, erasers: erased, hidden: hidden, fillRule: rule, transform: transform(offset),
        width: official.width, height: official.height)
      let shift = CGPoint(
        x: official.centroid.x - raster.centroid.x, y: official.centroid.y - raster.centroid.y)
      offset.x += shift.x
      offset.y += shift.y
      attempts += 1
      if abs(shift.x) < 0.25 && abs(shift.y) < 0.25 { break }
    } while attempts < 4
    return raster
  }
  if candidates.isEmpty {
    let additive = classify(parts, transform: transform(initial), official: official)
    candidates.append(("sampled", .winding, erasers(in: parts, additive: additive), []))
  }
  candidates.append(("evenodd", .evenOdd, [], []))
  candidates.append(("nonzero", .winding, [], []))

  var best: Interpretation?
  for (source, rule, erased, hidden) in candidates {
    let raster = registered(erased, hidden, rule)
    let score = mismatch(raster, official)
    if verbose {
      print(
        "  \(source): erasers=\(erased.sorted()) hidden=\(hidden.sorted()) "
          + "mismatch=\(String(format: "%.1f%%", score * 100))")
    }
    if best == nil || score < best!.mismatch {
      best = Interpretation(
        source: source, fillRule: rule, erasers: erased, hidden: hidden, mismatch: score,
        raster: raster)
    }
  }
  return best!
}

// MARK: - SVG output

func format(_ value: Double) -> String {
  var text = String(format: "%.3f", value)
  while text.hasSuffix("0") { text.removeLast() }
  if text.hasSuffix(".") { text.removeLast() }
  if text == "-0" { text = "0" }
  return text
}

func placement(for outline: NSBezierPath, entry: Entry, unitsPerPixel: Double, target: Double?)
  -> CGAffineTransform
{
  let bounds = outline.bounds
  let viewBox = entry.viewBox
  let padding = viewBox / 18 * (18 - maximumExtent) / 2
  let available = viewBox - padding * 2
  let largest = max(bounds.width * entry.stretch, bounds.height)
  var scale = target.map { $0 / largest } ?? (viewBox / 18) / unitsPerPixel
  let extent = largest * scale
  if extent > available {
    scale *= available / extent
  }
  scale *= entry.scale
  let scaleX = scale * entry.stretch
  let offsetX = (viewBox - bounds.width * scaleX) / 2 - bounds.minX * scaleX
  let offsetY = (viewBox - bounds.height * scale) / 2 - bounds.minY * scale
  return CGAffineTransform(translationX: offsetX, y: offsetY).scaledBy(x: scaleX, y: scale)
}

func pathData(_ path: CGPath, transform: CGAffineTransform) -> String {
  var data = ""
  func point(_ p: CGPoint) -> String {
    let q = p.applying(transform)
    return "\(format(q.x)) \(format(q.y))"
  }
  path.applyWithBlock { element in
    let e = element.pointee
    switch e.type {
    case .moveToPoint: data += "M\(point(e.points[0]))"
    case .addLineToPoint: data += "L\(point(e.points[0]))"
    case .addQuadCurveToPoint: data += "Q\(point(e.points[0])) \(point(e.points[1]))"
    case .addCurveToPoint:
      data += "C\(point(e.points[0])) \(point(e.points[1])) \(point(e.points[2]))"
    case .closeSubpath: data += "Z"
    @unknown default: break
    }
  }
  return data
}

func svg(_ parts: [Subpath], interpretation: Interpretation, viewBox: Double, transform: CGAffineTransform)
  -> String
{
  let size = format(viewBox)
  let rule = interpretation.fillRule == .evenOdd ? " fill-rule=\"evenodd\"" : ""
  let width = format(boldness * viewBox / 18)
  let stroke =
    boldness > 0
    ? " stroke=\"context-fill\" stroke-opacity=\"context-fill-opacity\" stroke-width=\"\(width)\" stroke-linejoin=\"round\""
    : ""
  let maskStroke = boldness > 0 ? " stroke=\"black\" stroke-width=\"\(width)\" stroke-linejoin=\"round\"" : ""
  var defs = ""
  var body = ""
  var pending = ""
  var masks = 0
  func flushPending() {
    if !pending.isEmpty {
      body += "<path\(rule)\(stroke) d=\"\(pending)\"/>"
      pending = ""
    }
  }
  for (index, part) in parts.enumerated() where !interpretation.hidden.contains(index) {
    let data = pathData(part.path, transform: transform)
    if interpretation.erasers.contains(index) {
      flushPending()
      masks += 1
      defs +=
        "<mask id=\"m\(masks)\" maskUnits=\"userSpaceOnUse\" x=\"0\" y=\"0\" "
        + "width=\"\(size)\" height=\"\(size)\">"
        + "<rect width=\"\(size)\" height=\"\(size)\" fill=\"white\" fill-opacity=\"1\"/>"
        + "<path fill=\"black\" fill-opacity=\"1\"\(maskStroke) d=\"\(data)\"/></mask>"
      body = "<g mask=\"url(#m\(masks))\">\(body)</g>"
    } else {
      pending += data
    }
  }
  flushPending()
  if !defs.isEmpty { defs = "<defs>\(defs)</defs>" }
  return fileHeader
    + "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(size)\" height=\"\(size)\" "
    + "fill=\"context-fill\" fill-opacity=\"context-fill-opacity\" viewBox=\"0 0 \(size) \(size)\">"
    + defs + body + "</svg>\n"
}

// MARK: - Main

let entries = loadEntries()

guard let reference = loadSymbol(referenceSymbol, weight: defaultWeight) else {
  fail("reference symbol \(referenceSymbol) is not available")
}
let unitsPerPixel = reference.outline.bounds.height / referenceExtent

if let nucleoFiles = try? FileManager.default.contentsOfDirectory(atPath: nucleoDir.path) {
  let mapped = Set(entries.map(\.file))
  for file in nucleoFiles.sorted() where file.hasSuffix(".svg") && !mapped.contains(file) {
    warn("\(file) exists in nucleo/ but has no entry in symbols.json")
  }
}

try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
if only.isEmpty, let existing = try? FileManager.default.contentsOfDirectory(atPath: outDir.path) {
  let generated = Set(entries.filter { $0.symbol != nil || $0.custom }.map(\.file))
  for file in existing where file.hasSuffix(".svg") && !generated.contains(file) {
    try? FileManager.default.removeItem(at: outDir.appendingPathComponent(file))
    print("Removed stale \(file)")
  }
}

var written = 0
var kept = 0
var custom = 0
var masked = 0
var outliers = 0
for entry in entries {
  guard let symbolName = entry.symbol else {
    if entry.custom {
      custom += 1
      if !FileManager.default.fileExists(atPath: outDir.appendingPathComponent(entry.file).path) {
        warn("\(entry.file) is marked custom but does not exist")
      }
    } else {
      kept += 1
    }
    continue
  }
  if !only.isEmpty && !only.contains(entry.file) { continue }
  let weight = weightOverride ?? entry.weight
  guard var symbol = loadSymbol(symbolName, weight: weight) else {
    fail("\(entry.file): SF Symbol \"\(symbolName)\" is not available on this macOS version")
  }
  var parts = subpaths(of: symbol.outline)
  let official = officialRaster(symbol.image)
  var interpretation = interpret(parts, symbol: symbol, official: official)
  if interpretation.mismatch > 0.3 {
    let sibling =
      symbolName.hasSuffix(".inverse")
      ? String(symbolName.dropLast(".inverse".count)) : symbolName + ".inverse"
    if let alternate = loadSymbol(sibling, weight: weight) {
      let alternateParts = subpaths(of: alternate.outline)
      let candidate = interpret(
        alternateParts, symbol: Symbol(outline: alternate.outline, image: symbol.image, layers: alternate.layers),
        official: official)
      if candidate.mismatch < interpretation.mismatch {
        if verbose { print("  using the outline of \(sibling) instead") }
        parts = alternateParts
        symbol = alternate
        interpretation = candidate
      }
    }
  }
  if let dumpDir = dumpDir {
    try? FileManager.default.createDirectory(at: dumpDir, withIntermediateDirectories: true)
    let base = entry.file.replacingOccurrences(of: ".svg", with: "")
    writePNG(official, to: dumpDir.appendingPathComponent("\(base)-official.png"))
    writePNG(interpretation.raster, to: dumpDir.appendingPathComponent("\(base)-ours.png"))
  }
  let transform = placement(
    for: symbol.outline, entry: entry, unitsPerPixel: unitsPerPixel,
    target: nucleoExtent(entry.like ?? entry.file, viewBox: entry.viewBox))
  let content = svg(
    parts, interpretation: interpretation, viewBox: entry.viewBox, transform: transform)
  let target = outDir.appendingPathComponent(entry.file)
  do {
    try content.write(to: target, atomically: true, encoding: .utf8)
  } catch {
    fail("cannot write \(target.path): \(error)")
  }
  written += 1
  if !interpretation.erasers.isEmpty { masked += 1 }
  let percent = String(format: "%.1f%%", interpretation.mismatch * 100)
  if interpretation.mismatch > mismatchWarning {
    outliers += 1
    warn(
      "\(entry.file) (\(symbolName)) differs from the official rendering by \(percent) "
        + "(\(interpretation.source))")
  } else if verbose {
    print(
      "\(entry.file): \(symbolName) \(percent) mismatch, \(interpretation.erasers.count) erasers "
        + "(\(interpretation.source))")
  }
}

print(
  "Wrote \(written) SF Symbol icons to \(outDir.path) (\(masked) with masks, \(outliers) outliers); "
    + "\(kept) icons keep their Nucleo version; \(custom) are hand-made")
