import { useCallback, useRef } from "react";

export function useDebounce(delay = 300) {
  const timeoutRef = useRef(0);
  const debounce = useCallback(
    (func: (...args: unknown[]) => unknown) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        func();
      }, delay);
    },
    [delay]
  );

  return debounce;
}
