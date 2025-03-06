import { useCallback, useEffect, useRef, useState } from 'react'


export function useAutoScroll<T>(value: T) {
  const res = useScroll()

  // Automatically scroll to bottom when the value changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: want to auto-scroll when value changes
  useEffect(() => {
    if (res.isScrolledToBottom) {
      res.scrollToBottom()
    }
  }, [res.isScrolledToBottom, res.scrollToBottom, value])

  return res
}

// Hook for managing scroll behavior in components with scrollable content
export function useScroll() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const [isScrolledToTop, setIsScrolledToTop] = useState(true)
  const lastStateRef = useRef(true)
  
  // Threshold in pixels to determine if scrolled to top or bottom
  const SCROLL_THRESHOLD = 50

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      // console.log('no scroll element found')
      return
    }

    // Use requestAnimationFrame to ensure content is rendered
    requestAnimationFrame(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      })
    })
  }, [])

  const scrollToTop = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    requestAnimationFrame(() => {
      element.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    })
  }, [])

  // Handle scroll events
  const onScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    const isAtBottom = 
      Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < SCROLL_THRESHOLD
    
    const isAtTop = element.scrollTop < SCROLL_THRESHOLD
    
    if (isAtBottom !== lastStateRef.current) {
      console.log('auto-scroll:', isAtBottom ? 'enabled' : 'disabled')
      lastStateRef.current = isAtBottom
    }
    
    setIsScrolledToBottom(isAtBottom)
    setIsScrolledToTop(isAtTop)
  }, [])

  return { 
    scrollRef, 
    onScroll, 
    isScrolledToBottom,
    isScrolledToTop,
    scrollToBottom,
    scrollToTop
  }
}