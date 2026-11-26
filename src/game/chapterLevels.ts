import type { LevelConfig } from './levels';

export const NEW_CITY_LEVELS: readonly LevelConfig[] = [
  {
    id: 9, city: 1, name: '港口双灯', chapter: '港口',
    subtitle: '将分光点放到两条支路都能抵达的位置。',
    size: 5, source: [1, 2], sourceDirection: 3, district: 0, districtCenter: [0, 0], parMoves: 3,
    reflection: {
      lightTargets: 2, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [4, 1], "state": 0, "locked": true},
        {"id": "P2", "kind": "single", "at": [4, 0], "state": 3, "locked": false},
      ],
      inventory: [{"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 10, city: 1, name: '泊船信标', chapter: '港口',
    subtitle: '沿着弯折航线找到闸门的通过轴。',
    size: 5, source: [3, 4], sourceDirection: 3, district: 0, districtCenter: [0, 0], parMoves: 8,
    reflection: {
      lightTargets: 1, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [3, 2], "state": 0, "locked": true},
        {"id": "P2", "kind": "mirror", "at": [2, 3], "state": 1, "locked": false},
        {"id": "P3", "kind": "mirror", "at": [2, 0], "state": 1, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}],
    },
  },
  {
    id: 11, city: 1, name: '石阶折光', chapter: '市集',
    subtitle: '控制光塔与分光，让支路同时经过街口。',
    size: 5, source: [2, 4], sourceDirection: 2, district: 1, districtCenter: [0, 0], parMoves: 5,
    reflection: {
      lightTargets: 2, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [3, 0], "state": 0, "locked": true},
        {"id": "P2", "kind": "checkpoint", "at": [2, 3], "state": 0, "locked": true},
        {"id": "P3", "kind": "mirror", "at": [3, 1], "state": 1, "locked": false},
        {"id": "P4", "kind": "single", "at": [2, 0], "state": 0, "locked": true},
      ],
      inventory: [{"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 12, city: 1, name: '市集回廊', chapter: '市集',
    subtitle: '用共用折点串起两处背灯。',
    size: 5, source: [4, 1], sourceDirection: 2, district: 1, districtCenter: [0, 0], parMoves: 9,
    reflection: {
      lightTargets: 2, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [1, 0], "state": 0, "locked": true},
        {"id": "P2", "kind": "mirror", "at": [1, 1], "state": 0, "locked": false},
        {"id": "P3", "kind": "single", "at": [4, 0], "state": 3, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [3, 4], "state": 0, "locked": true},
      ],
      inventory: [{"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 13, city: 1, name: '双门火道', chapter: '剧场',
    subtitle: '分给两条光路的同时，检查两道门的计数。',
    size: 5, source: [0, 4], sourceDirection: 3, district: 2, districtCenter: [0, 0], parMoves: 3,
    reflection: {
      lightTargets: 2, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [4, 2], "state": 1, "locked": true},
        {"id": "P2", "kind": "checkpoint", "at": [4, 3], "state": 0, "locked": true},
        {"id": "P3", "kind": "checkpoint", "at": [1, 2], "state": 1, "locked": true},
        {"id": "P4", "kind": "single", "at": [4, 4], "state": 2, "locked": true},
        {"id": "P5", "kind": "mirror", "at": [0, 2], "state": 1, "locked": false},
      ],
      inventory: [{"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 14, city: 1, name: '剧场两侧', chapter: '剧场',
    subtitle: '三盏背灯共享同一座光塔。',
    size: 5, source: [0, 1], sourceDirection: 0, district: 2, districtCenter: [0, 0], parMoves: 10,
    reflection: {
      lightTargets: 3, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [3, 3], "state": 0, "locked": true},
        {"id": "P2", "kind": "single", "at": [4, 2], "state": 2, "locked": false},
        {"id": "P3", "kind": "checkpoint", "at": [2, 3], "state": 0, "locked": false},
        {"id": "P4", "kind": "single", "at": [3, 1], "state": 0, "locked": true},
        {"id": "P5", "kind": "splitter", "at": [0, 3], "state": 0, "locked": false},
      ],
      inventory: [{"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 15, city: 1, name: '卫城长廊', chapter: '卫城',
    subtitle: '长光路要穿过廊柱间的每一件器件。',
    size: 5, source: [1, 3], sourceDirection: 0, district: 3, districtCenter: [0, 0], parMoves: 7,
    reflection: {
      lightTargets: 2, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [2, 3], "state": 0, "locked": true},
        {"id": "P2", "kind": "single", "at": [4, 4], "state": 0, "locked": false},
        {"id": "P3", "kind": "mirror", "at": [4, 2], "state": 0, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [2, 1], "state": 1, "locked": true},
        {"id": "P5", "kind": "checkpoint", "at": [1, 1], "state": 1, "locked": true},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 16, city: 1, name: '神庙三炬', chapter: '卫城',
    subtitle: '先为三条支路保留空间，再安排库存。',
    size: 5, source: [2, 0], sourceDirection: 1, district: 3, districtCenter: [0, 0], parMoves: 9,
    reflection: {
      lightTargets: 3, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [2, 3], "state": 0, "locked": true},
        {"id": "P2", "kind": "single", "at": [0, 1], "state": 1, "locked": false},
        {"id": "P3", "kind": "mirror", "at": [3, 4], "state": 1, "locked": false},
        {"id": "P4", "kind": "splitter", "at": [2, 2], "state": 1, "locked": true},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 2}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 17, city: 2, name: '外滩折线', chapter: '外滩',
    subtitle: '用同一束光照向两侧，还要穿过外滩闸门。',
    size: 5, source: [2, 1], sourceDirection: 2, district: 0, districtCenter: [0, 0], parMoves: 9,
    reflection: {
      lightTargets: 2, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [3, 3], "state": 1, "locked": true},
        {"id": "P2", "kind": "mirror", "at": [0, 3], "state": 0, "locked": false},
        {"id": "P3", "kind": "single", "at": [4, 3], "state": 0, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [0, 0], "state": 0, "locked": true},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 18, city: 2, name: '连岸信号', chapter: '外滩',
    subtitle: '背灯达标后，再检查两处门轴。',
    size: 5, source: [1, 0], sourceDirection: 2, district: 0, districtCenter: [0, 0], parMoves: 7,
    reflection: {
      lightTargets: 2, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [4, 3], "state": 0, "locked": true},
        {"id": "P2", "kind": "single", "at": [0, 4], "state": 0, "locked": false},
        {"id": "P3", "kind": "checkpoint", "at": [4, 1], "state": 1, "locked": false},
        {"id": "P4", "kind": "checkpoint", "at": [0, 2], "state": 0, "locked": true},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 19, city: 2, name: '滨江灯带', chapter: '滨江',
    subtitle: '三条支路与两道闸门都要成立。',
    size: 5, source: [0, 3], sourceDirection: 0, district: 1, districtCenter: [0, 0], parMoves: 10,
    reflection: {
      lightTargets: 3, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [1, 3], "state": 1, "locked": true},
        {"id": "P2", "kind": "checkpoint", "at": [2, 2], "state": 0, "locked": true},
        {"id": "P3", "kind": "single", "at": [4, 4], "state": 3, "locked": false},
        {"id": "P4", "kind": "splitter", "at": [2, 3], "state": 0, "locked": true},
        {"id": "P5", "kind": "single", "at": [3, 4], "state": 0, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 20, city: 2, name: '江面回环', chapter: '滨江',
    subtitle: '留给沿江支路的屋顶也是另一条路的折点。',
    size: 5, source: [2, 4], sourceDirection: 1, district: 1, districtCenter: [0, 0], parMoves: 12,
    reflection: {
      lightTargets: 3, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [3, 3], "state": 1, "locked": true},
        {"id": "P2", "kind": "splitter", "at": [1, 1], "state": 0, "locked": false},
        {"id": "P3", "kind": "single", "at": [4, 3], "state": 2, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [1, 4], "state": 1, "locked": true},
        {"id": "P5", "kind": "single", "at": [4, 0], "state": 0, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 21, city: 2, name: '塔影三束', chapter: '东方明珠',
    subtitle: '先找能同时服务三条光路的分流点。',
    size: 5, source: [0, 4], sourceDirection: 0, district: 2, districtCenter: [0, 0], parMoves: 9,
    reflection: {
      lightTargets: 3, sourceRotatable: false,
      pieces: [
        {"id": "P1", "kind": "single", "at": [0, 2], "state": 3, "locked": true},
        {"id": "P2", "kind": "mirror", "at": [2, 2], "state": 1, "locked": false},
        {"id": "P3", "kind": "checkpoint", "at": [1, 2], "state": 1, "locked": true},
        {"id": "P4", "kind": "splitter", "at": [4, 2], "state": 1, "locked": true},
        {"id": "P5", "kind": "mirror", "at": [2, 1], "state": 1, "locked": false},
        {"id": "P6", "kind": "single", "at": [2, 3], "state": 3, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 22, city: 2, name: '明珠联灯', chapter: '东方明珠',
    subtitle: '三盏背灯，两道闸门，一套库存。',
    size: 5, source: [1, 2], sourceDirection: 2, district: 2, districtCenter: [0, 0], parMoves: 12,
    reflection: {
      lightTargets: 3, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "checkpoint", "at": [3, 1], "state": 1, "locked": true},
        {"id": "P2", "kind": "checkpoint", "at": [1, 4], "state": 0, "locked": false},
        {"id": "P3", "kind": "splitter", "at": [2, 1], "state": 0, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [2, 4], "state": 0, "locked": true},
        {"id": "P5", "kind": "single", "at": [2, 0], "state": 0, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 1}, {"kind": "single", "count": 2}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 23, city: 2, name: '金融城四盏', chapter: '陆家嘴',
    subtitle: '四盏背灯共享有限的分光位置。',
    size: 5, source: [4, 2], sourceDirection: 1, district: 3, districtCenter: [0, 0], parMoves: 11,
    reflection: {
      lightTargets: 4, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "splitter", "at": [2, 1], "state": 1, "locked": true},
        {"id": "P2", "kind": "checkpoint", "at": [2, 4], "state": 1, "locked": true},
        {"id": "P3", "kind": "single", "at": [4, 4], "state": 3, "locked": false},
        {"id": "P4", "kind": "single", "at": [0, 1], "state": 3, "locked": true},
        {"id": "P5", "kind": "single", "at": [3, 0], "state": 2, "locked": false},
        {"id": "P6", "kind": "splitter", "at": [2, 2], "state": 0, "locked": false},
      ],
      inventory: [{"kind": "mirror", "count": 2}, {"kind": "single", "count": 1}, {"kind": "splitter", "count": 1}],
    },
  },
  {
    id: 24, city: 2, name: '两岸归航', chapter: '陆家嘴',
    subtitle: '折线、分流与双闸门必须一起成立。',
    size: 5, source: [1, 2], sourceDirection: 0, district: 3, districtCenter: [0, 0], parMoves: 17,
    reflection: {
      lightTargets: 3, sourceRotatable: true,
      pieces: [
        {"id": "P1", "kind": "mirror", "at": [4, 0], "state": 1, "locked": true},
        {"id": "P2", "kind": "single", "at": [0, 4], "state": 1, "locked": false},
        {"id": "P3", "kind": "splitter", "at": [2, 0], "state": 1, "locked": false},
        {"id": "P4", "kind": "mirror", "at": [1, 3], "state": 1, "locked": true},
        {"id": "P5", "kind": "checkpoint", "at": [2, 1], "state": 1, "locked": false},
        {"id": "P6", "kind": "mirror", "at": [2, 4], "state": 1, "locked": false},
      ],
      inventory: [{"kind": "checkpoint", "count": 1}, {"kind": "mirror", "count": 1}, {"kind": "single", "count": 2}, {"kind": "splitter", "count": 1}],
    },
  },
];
