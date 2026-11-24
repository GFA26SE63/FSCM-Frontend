/** List columns are a feature decision, independent of viewport width. */
export function listColumns<T>(columns: readonly T[], names: readonly string[] | undefined, nameOf: (column: T) => string): T[] {
  if (!names) return [...columns];
  return names.map(name => {
    const column = columns.find(item => nameOf(item) === name);
    if (!column) throw new Error(`Unknown list column: ${name}`);
    return column;
  });
}
