export function SystemPreview() {
  return (
    <section className="system-preview" aria-label="Ascent workspace preview">
      <div className="preview-topbar">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-300">
            Today
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-ink-950 dark:text-white">Store pulse</h3>
        </div>
        <span className="status-dot">Live</span>
      </div>

      <div className="preview-ledger">
        <div>
          <span>POS sales</span>
          <strong>$842.20</strong>
        </div>
        <div>
          <span>Online orders</span>
          <strong>18</strong>
        </div>
        <div>
          <span>Low stock</span>
          <strong>6</strong>
        </div>
      </div>

      <div className="preview-chart" aria-hidden="true">
        {[32, 48, 40, 64, 58, 82, 74].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>

      <div className="preview-list">
        <div>
          <span className="list-marker amber" />
          <p>Fresh Eggs Dozen</p>
          <strong>36 left</strong>
        </div>
        <div>
          <span className="list-marker violet" />
          <p>Night Market Coffee</p>
          <strong>Reorder</strong>
        </div>
        <div>
          <span className="list-marker blue" />
          <p>Order ORD-1048</p>
          <strong>Packed</strong>
        </div>
      </div>
    </section>
  )
}
