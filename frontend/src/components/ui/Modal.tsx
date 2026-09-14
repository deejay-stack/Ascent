import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
export function Modal({title,children,onClose,className=''}:{title:string;children:ReactNode;onClose:()=>void;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    const dialog=ref.current
    dialog?.showModal()
    return ()=>{dialog?.close();previous?.focus()}
  },[])
  return createPortal(<dialog ref={ref} className={`ascent-modal ${className}`} onCancel={event=>{event.preventDefault();onClose()}} aria-label={title}><header className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={18}/></button></header>{children}</dialog>,document.body)
}

