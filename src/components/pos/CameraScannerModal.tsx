import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'

export function CameraScannerModal({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const generation = useRef(0)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const stop = () => {
    generation.current++
    controls.current?.stop()
    controls.current = null
    const stream = video.current?.srcObject
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop())
  }
  useEffect(() => () => stop(), [])
  const start = async () => {
    if (active) return
    setActive(true)
    setError('')
    const attempt = ++generation.current
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera access needs HTTPS or localhost and a supported browser.')
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      if (attempt !== generation.current || !video.current) return
      const reader = new BrowserMultiFormatReader()
      const session = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        video.current,
        (result, _error, scanner) => {
          if (result && attempt === generation.current) {
            scanner.stop()
            stop()
            onScan(result.getText())
            onClose()
          }
        },
      )
      if (attempt !== generation.current) session.stop()
      else controls.current = session
    } catch (cause) {
      if (attempt !== generation.current) return
      stop()
      setActive(false)
      setError(
        cause instanceof Error && cause.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser or use the barcode input.'
          : cause instanceof Error
            ? cause.message
            : 'The camera could not start.',
      )
    }
  }
  return (
    <Modal title="Camera scanner" onClose={onClose}>
      <p>
        Start the camera and hold one product barcode inside the preview. A successful scan adds it
        to the bill.
      </p>
      <video
        ref={video}
        muted
        playsInline
        style={{ width: '100%', maxHeight: 360, background: '#152b24', borderRadius: 16 }}
        aria-label="Barcode camera preview"
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="action-row">
        {active ? (
          <button
            className="button button-secondary"
            onClick={() => {
              stop()
              setActive(false)
            }}
          >
            Stop camera
          </button>
        ) : (
          <button className="button button-primary" onClick={() => void start()}>
            Start camera
          </button>
        )}
        <button className="button button-secondary" onClick={onClose}>
          Use barcode input
        </button>
      </div>
    </Modal>
  )
}
