import { money } from '../../services/money'
export function BarChart({title,rows}:{title:string;rows:{name:string;value:number}[]}) {
  const max=Math.max(1,...rows.map(r=>r.value))
  return <section className="report-panel"><h3>{title}</h3>{rows.length&&rows.some(r=>r.value>0)?<div className="bar-chart" role="img" aria-label={`${title}: ${rows.map(r=>r.name+' '+money(r.value)).join(', ')}`}>{rows.map(r=><div className="chart-row" key={r.name}><span>{r.name}</span><div className="chart-track"><div style={{width:`${r.value/max*100}%`}}/></div><strong>{money(r.value)}</strong></div>)}</div>:<p className="pos-empty">No completed sales in this period.</p>}</section>
}
