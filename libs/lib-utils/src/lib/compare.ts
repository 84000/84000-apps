/* eslint-disable @typescript-eslint/no-explicit-any */
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

export const jsonEqual = (a: unknown, b: unknown): boolean => {
  try {
    const parsedA = JSON.stringify(a);
    const parsedB = JSON.stringify(b);
    return parsedA === parsedB;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return false;
  }
};

export const isInBounds = (evt: MouseEvent, element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const { clientX, clientY } = evt;

  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
};
