/** Fixed table layout otherwise gives flexible columns zero space when fixed columns exceed the viewport. */
export function minimumTableWidth(columns: readonly { width?: string }[], actionWidth?: string): number {
  const pixels = (width: string | undefined, fallback: number) => {
    const match = width?.match(/^(\d+(?:\.\d+)?)px$/);
    return match ? Number(match[1]) : fallback;
  };
  return columns.reduce((total, column) => total + pixels(column.width, 160), 0)
    + (actionWidth ? pixels(actionWidth, 220) : 0);
}
