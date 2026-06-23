import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Edit, Trash2, Eye, Wand2, Route, Archive, ArchiveRestore, Sparkles } from 'lucide-react'
import './ActionsMenu.css'

interface ActionsMenuProps {
  onView?: () => void
  onEdit: () => void
  onEditContext?: () => void
  onGenerateRoadmap?: () => void
  /** Si se pasa, muestra la acción "Generate ficha" (varita IA). Para /calls. */
  onGenerateFicha?: () => void
  onDelete?: () => void
  /** Si se pasa, muestra la acción "Archive" o "Unarchive" según isArchived. */
  onArchive?: () => void
  /** Si true, el item ya está archivado → se muestra "Unarchive". */
  isArchived?: boolean
}

interface MenuPosition {
  top: number
  left: number
  openUp: boolean
}

const MENU_WIDTH = 200
const MENU_HEIGHT_ESTIMATE = 224 // ~ 5 items * 40px + padding
const VIEWPORT_PADDING = 8

const ActionsMenu = ({ onView, onEdit, onEditContext, onGenerateRoadmap, onGenerateFicha, onDelete, onArchive, isArchived }: ActionsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, openUp: false })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const computePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // Por defecto: aparece debajo del trigger alineado a la derecha
    let top = rect.bottom + 4
    let openUp = false

    // Si no cabe abajo, abre arriba
    if (rect.bottom + MENU_HEIGHT_ESTIMATE + VIEWPORT_PADDING > viewportHeight) {
      top = rect.top - MENU_HEIGHT_ESTIMATE - 4
      openUp = true
    }

    // Alinea el lado derecho del menu con el lado derecho del trigger
    let left = rect.right - MENU_WIDTH
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING
    if (left + MENU_WIDTH + VIEWPORT_PADDING > viewportWidth) {
      left = viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
    }

    setPosition({ top, left, openUp })
  }

  // Posiciona al abrir y cada vez que cambien tamaño/scroll
  useLayoutEffect(() => {
    if (!isOpen) return
    computePosition()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const trigger = triggerRef.current
      const dropdown = dropdownRef.current
      const target = event.target as Node
      if (
        trigger && !trigger.contains(target) &&
        dropdown && !dropdown.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    const handleReposition = () => computePosition()

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        className="actions-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`actions-menu-dropdown actions-menu-dropdown--portal ${position.openUp ? 'actions-menu-dropdown--up' : ''}`}
          style={{
            top: position.top,
            left: position.left,
            width: MENU_WIDTH,
          }}
          role="menu"
        >
          {onView && (
            <button
              type="button"
              className="actions-menu-item"
              onClick={() => { onView(); setIsOpen(false) }}
            >
              <Eye size={16} />
              <span>View</span>
            </button>
          )}
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => { onEdit(); setIsOpen(false) }}
          >
            <Edit size={16} />
            <span>Edit</span>
          </button>
          {onEditContext && (
            <button
              type="button"
              className="actions-menu-item actions-menu-item--ai"
              onClick={() => { onEditContext(); setIsOpen(false) }}
            >
              <Wand2 size={16} />
              <span>Edit context</span>
            </button>
          )}
          {onGenerateRoadmap && (
            <button
              type="button"
              className="actions-menu-item actions-menu-item--ai"
              onClick={() => { onGenerateRoadmap(); setIsOpen(false) }}
            >
              <Route size={16} />
              <span>Generate roadmap</span>
            </button>
          )}
          {onGenerateFicha && (
            <button
              type="button"
              className="actions-menu-item actions-menu-item--ai"
              onClick={() => { onGenerateFicha(); setIsOpen(false) }}
            >
              <Sparkles size={16} />
              <span>Generate brief</span>
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              className={`actions-menu-item ${isArchived ? '' : 'actions-menu-item--archive'}`}
              onClick={() => { onArchive(); setIsOpen(false) }}
            >
              {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              <span>{isArchived ? 'Unarchive' : 'Archive'}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="actions-menu-item delete"
              onClick={() => { onDelete(); setIsOpen(false) }}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default ActionsMenu
