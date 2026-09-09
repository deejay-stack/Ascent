import { Minus, Plus } from 'lucide-react'
export function QuantityControl({name,value,max,onChange}:{name:string;value:number;max:number;onChange:(n:number)=>void}) {
  return <div className="quantity-control"><button type="button" aria-label={`Decrease ${name}`} disabled={value<=1} onClick={()=>onChange(value-1)}><Minus size={15}/></button><output aria-label={`Quantity for ${name}`}>{value}</output><button type="button" aria-label={`Increase ${name}`} disabled={value>=max} onClick={()=>onChange(value+1)}><Plus size={15}/></button></div>
}

