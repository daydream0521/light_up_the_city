import { SOLUTIONS } from './campaign-solutions';
import type { GridPoint, LevelConfig, PieceKind } from './levels';
import type { ReflectionGameState } from './reflection';
import type { CellMove } from './reflectionPlay';

export const APPROACHES = [
  '先只翻转镜面，让离开棋盘的光折向背灯镜。光到达后，再把目标的背灯面转向入射光。',
  '先留一段长直线给光塔，把镜面放在这条线上。背灯镜应落在折过去的支路上。',
  '先决定哪一面镜把光带回背灯，另一面镜放在它的上游。库存两面镜都要进入这条光路。',
  '让分光镜把反射光送去离开主线的那盏灯。直行光会继续向前，只需单独检查主线末端背灯的朝向。',
  '锁定镜面已经决定了折线路径。顺着它看闸门是沿哪条轴被穿过，再单独调整末端背灯。',
  '先让光塔对准分光镜。直行支路够得着近处的背灯，另一支需要借上方镜面转向远处。',
  '把固定闸门当成锚点。分光镜的一支要沿闸门的轴通过，另一支把光送向闸门通路之外的背灯。',
  '五面背灯镜可以只点亮三盏。给余下两面安排反射或末端位置，让光也经过它们。',
  '从两件锁定器件倒推。先确定穿闸的那段直线，再分配其余支路；只取得足够背灯还不够。',
  '锁定镜面能把横向光折给上方的背灯。让光塔从旁边切入，并在这段横线出发的地方分一束给另一盏灯。',
  '把港口的固定门轴作为长直线。弯折安排在闸门之前或之后，别在光束到门之前就把它送离这条线。',
  '光塔可转向。先观察哪条路线能经过固定闸门，分支再安排给固定背灯与旁边的镜面。',
  '把左侧两面镜当作回廊的连续折点。分光点要让去回廊的光与去远处背灯的光同时有出口。',
  '两扇锁定闸门的轴不同。先用可转镜面把光引入两扇门共用的路线，再从可用的折点分一支给新背灯。',
  '先让光塔附近的分光器工作。直行与反射分别照顾剧场两边，空着的门轴留待知道来光方向后再转。',
  '锁定镜面先把光送进长廊。让一支光走过固定闸门折向边缘屋顶，另一支经可转镜面折向长廊末端。',
  '固定闸门正对着光塔的一条直线。可以在门前分一支，保留直线到门后再折回其余背灯。',
  '先将光塔转向上方的屋顶。想办法沿上沿把光交给左侧折线，再分出一支经过闸门附近。',
  '从锁定闸门的方向倒推哪一面镜负责把光送进门轴。把分光留给另一处背灯，别让它改变穿闸方向。',
  '光塔前方的固定分光镜已经分出第一条支路。让库存分光镜接力，比尝试改变第一处分流位置更有效。',
  '先理清沿河的长路径，找到直行光会遇到哪一处分光镜。给回折的支路留一个角上的屋顶。',
  '把最右侧一列看作一条共用竖线。尽量在行列相交处引出支路，让上下两端都能得到光。',
  '左上附近有两条补光路线可以共用一处分光。先保证闸门计数，再检查最右侧新增背灯的来光。',
  '四盏灯需要几次分流。试着让最靠边的镜负责折回长光路，把库存分光镜留在能同时接通上下游的位置。',
  '先从光塔下方构造可用折线，再让分光的一支驶向右侧的库存闸门。到达背灯前确认两道门恰好通过。',
] as const;

export interface GuideMove extends CellMove {
  kind: 'source' | PieceKind;
  direction?: number;
}

const sameCell = (a: GridPoint, b: GridPoint): boolean => a[0] === b[0] && a[1] === b[1];

export function referenceMoves(level: LevelConfig, state: ReflectionGameState): GuideMove[] {
  const solution = SOLUTIONS[level.id];
  const expected = solution.placements.map(item => ({ ...item, at: [item.x, item.z] as GridPoint }));
  const moves: GuideMove[] = [];
  for (const placed of state.placements) {
    if (!expected.some(item => sameCell(item.at, placed.at) && item.kind === placed.kind)) {
      moves.push({ at: placed.at, tool: 'erase', kind: placed.kind });
    }
  }

  const rotate = (at: GridPoint, kind: GuideMove['kind'], from: number, to: number) => {
    const cycle = kind === 'source' || kind === 'single' ? 4 : 2;
    for (let angle = from; angle !== to;) {
      angle = (angle + 1) % cycle;
      moves.push({ at, tool: null, kind, direction: angle });
    }
  };
  rotate(level.source, 'source', state.sourceDirection, solution.sourceDirection);
  level.reflection.pieces.forEach((piece, index) => {
    rotate(piece.at, piece.kind, state.pieceStates[index], solution.pieceStates[index]);
  });
  for (const item of expected) {
    const placed = state.placements.find(piece => sameCell(piece.at, item.at) && piece.kind === item.kind);
    if (!placed) moves.push({ at: item.at, tool: item.kind, kind: item.kind, direction: 0 });
    rotate(item.at, item.kind, placed?.state ?? 0, item.state);
  }
  return moves;
}
