import AppKit
let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let background = NSBezierPath(roundedRect: NSRect(x: 45, y: 45, width: 934, height: 934), xRadius: 210, yRadius: 210)
NSColor(calibratedRed: 0.065, green: 0.085, blue: 0.11, alpha: 1).setFill(); background.fill()
let circle = NSBezierPath(ovalIn: NSRect(x: 172, y: 172, width: 680, height: 680))
NSGraphicsContext.saveGraphicsState(); circle.addClip()
NSGradient(colorsAndLocations: (NSColor(calibratedRed: 0.16, green: 0.28, blue: 0.37, alpha: 1),0.0),(NSColor(calibratedRed: 0.46, green: 0.63, blue: 0.70, alpha: 1),0.45),(NSColor(calibratedRed: 0.94, green: 0.82, blue: 0.64, alpha: 1),1.0))!.draw(in: circle, angle: 125)
let glow = NSGradient(starting: NSColor(calibratedWhite: 1, alpha: 0.6), ending: NSColor(calibratedWhite: 1, alpha: 0))!
glow.draw(fromCenter: NSPoint(x: 340, y: 720), radius: 0, toCenter: NSPoint(x: 380, y: 620), radius: 370, options: [])
for i in 0..<35 {
 let y = CGFloat(195 + i * 19)
 let line = NSBezierPath(); line.move(to: NSPoint(x: 130, y: y)); line.curve(to: NSPoint(x: 900, y: y-80), controlPoint1: NSPoint(x: 380, y: y+150), controlPoint2: NSPoint(x: 580, y: y-140));line.lineWidth = 1.5
 NSColor(calibratedWhite: 1, alpha: 0.09).setStroke();line.stroke()
}
NSGraphicsContext.restoreGraphicsState()
NSColor(calibratedWhite: 1, alpha: 0.28).setStroke(); circle.lineWidth = 2; circle.stroke()
NSGraphicsContext.restoreGraphicsState()
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
