import { MaskedText } from './MaskedText'

export function SplitTextReveal({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <span className={className}>
      {lines.map((line, index) => <MaskedText delay={0.08 + index * 0.09} key={line}>{line}</MaskedText>)}
    </span>
  )
}
