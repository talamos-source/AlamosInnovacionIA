import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Edit, Trash2, Eye } from 'lucide-react'
import './ActionsMenu.css'

interface ActionsMenuProps {
  onView?: () => void
  onEdit: () => void
  onDelete?: () => void
}

const ActionsMenu = ({ onView, onEdit, onDelete }: ActionsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="actions-menu-container" ref={menuRef}>
      <button
        className="actions-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Actions"
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <div className="actions-menu-dropdown">
          {onView && (
            <button className="actions-menu-item" onClick={() => { onView(); setIsOpen(false) }}>
              <Eye size={16} />
              <span>View</span>
            </button>
          )}
          <button className="actions-menu-item" onClick={() => { onEdit(); setIsOpen(false) }}>
            <Edit size={16} />
            <span>Edit</span>
          </button>
          {onDelete && (
            <button className="actions-menu-item delete" onClick={() => { onDelete(); setIsOpen(false) }}>
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ActionsMenu
