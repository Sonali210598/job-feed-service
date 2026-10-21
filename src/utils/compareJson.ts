
export const compareJson = (a: unknown, b: unknown): boolean => {
    if (a === b) {
      return true;
    }
  
    if (Array.isArray(a) && Array.isArray(b)) {
      return (
        a.length === b.length &&
        a.every((item, index) => compareJson(item, b[index]))
      );
    }
  
    if (
      typeof a === "object" &&
      typeof b === "object" &&
      a !== null &&
      b !== null &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
  
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);
  
      return (
        keysA.length === keysB.length &&
        keysA.every(
          (key) =>
            Object.prototype.hasOwnProperty.call(objB, key) &&
            compareJson(objA[key], objB[key])
        )
      );
    }
  
    return false;
  };
  