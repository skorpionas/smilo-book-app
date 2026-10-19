/**
 * Cards that overlap in one groomer's lane (visits saved at the same time on purpose)
 * are drawn next to each other instead of on top of each other.
 *
 * Cards are grouped into clusters of transitively overlapping cards; inside a cluster
 * each card takes the first free column, and every card of the cluster gets the same
 * column count, so their widths line up. Rows are grid rows: [row, row + span).
 */
export type Span = { row: number; span: number };
export type SideBySide<T> = { item: T; col: number; cols: number };

export function sideBySide<T extends Span>(items: readonly T[]): SideBySide<T>[] {
  const sorted = [...items].sort((a, b) => a.row - b.row || b.span - a.span);
  const out: SideBySide<T>[] = [];
  let cluster: SideBySide<T>[] = [];
  let columnsEnd: number[] = []; // per column: the row where its last card ends
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) c.cols = columnsEnd.length;
    out.push(...cluster);
    cluster = [];
    columnsEnd = [];
  };

  for (const item of sorted) {
    if (item.row >= clusterEnd) flush();
    let col = columnsEnd.findIndex((end) => end <= item.row);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(0);
    }
    columnsEnd[col] = item.row + item.span;
    clusterEnd = Math.max(clusterEnd, item.row + item.span);
    cluster.push({ item, col, cols: 1 });
  }
  flush();
  return out;
}
