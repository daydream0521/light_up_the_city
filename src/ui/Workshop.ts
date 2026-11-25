import type { Direction, GridPoint, PieceKind } from '../game/levels';
import { initialReflectionState, placementZones, traceReflection } from '../game/reflection';
import {
  DISTRICTS, NAME_LIMIT, PIECE_KINDS, deleteWork, newPuzzle, puzzleLevel, readWorks, saveWork, shareLink,
  type Puzzle, type Work,
} from '../game/workshop';
import type { CityScene } from '../scene/CityScene';
import { TOOL_LABELS } from './GameUI';

type EditorTool = PieceKind | 'source' | 'select' | 'move';
type PlayMode = 'trial' | 'challenge';

interface Callbacks {
  showWorkshop: (editing: boolean) => void;
  play: (puzzle: Puzzle, mode: PlayMode) => void;
  home: () => void;
  reset: () => void;
  begin: () => void;
}

const button = (action: string, label: string, style = 'icon-button') =>
  `<button type="button" class="${style}" data-work="${action}">${label}</button>`;
const sameCell = (a: GridPoint, b: GridPoint) => a[0] === b[0] && a[1] === b[1];
const DIRECTIONS = ['东', '南', '西', '北'];
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export class Workshop {
  private readonly root: HTMLElement;
  private work = this.newWork(newPuzzle());
  private dirty = true;
  private history: { puzzle: Puzzle; affectsPlay: boolean }[] = [];
  private selected: GridPoint | null = null;
  private tool: EditorTool = 'select';
  private shared: Puzzle | null = null;

  constructor(shell: HTMLElement, private readonly scene: CityScene, private readonly callbacks: Callbacks) {
    shell.insertAdjacentHTML('beforeend', `
      <div id="workshop-ui">
        <section id="work-library" class="work-library" aria-labelledby="work-library-title" hidden>
          <div class="work-heading">
            <div><p>造光工坊</p><h2 id="work-library-title">我的关卡</h2></div>
            ${button('home', '游戏首页')}
          </div>
          ${button('new', '新建关卡', 'primary-button')}
          <div id="work-list"></div>
          <p id="work-library-message" class="work-message" role="status"></p>
        </section>
        <section id="work-editor" aria-labelledby="work-editor-title" hidden>
          <header class="work-editor-head">
            <div><h2 id="work-editor-title">造光工坊</h2><p id="work-state"></p></div>
            <div class="work-actions">
              ${button('library', '我的关卡')}
              ${button('save', '保存')}
              ${button('trial', '试玩', 'primary-button')}
            </div>
          </header>
          <details class="work-settings work-surface">
            <summary>关卡设置</summary>
            <label>关卡名称<input id="work-name" maxlength="${NAME_LIMIT}"></label>
            <label>城市街区<select id="work-district">${DISTRICTS.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select></label>
            <label>背灯目标<input id="work-target" type="number" min="1" max="24" inputmode="numeric" required></label>
            <fieldset><legend>玩家库存</legend>
              ${PIECE_KINDS.map((kind) => `<label>${TOOL_LABELS[kind]}<input id="work-stock-${kind}" type="number" min="0" max="24" inputmode="numeric" required></label>`).join('')}
            </fieldset>
          </details>
          <div class="work-controls work-surface">
            <p id="work-feedback" class="work-message" role="status"></p>
            <div id="work-selection" class="work-selection">
              <p id="work-piece"></p>
              <div class="work-actions">
                ${button('rotate', '旋转')}
                ${button('lock', '锁定')}
                ${button('move', '移动')}
                ${button('remove', '删除')}
              </div>
            </div>
            <div class="work-palette" role="group" aria-label="编辑工具">
              ${button('tool-select', '选中')}
              ${button('tool-source', '光塔')}
              ${PIECE_KINDS.map((kind) => button(`tool-${kind}`, TOOL_LABELS[kind])).join('')}
            </div>
            <div class="work-commands">
              ${button('undo', '撤销')}
              ${button('clear', '清空预置')}
              ${button('share', '分享链接')}
            </div>
            <label id="work-share" class="work-share" hidden>分享链接<input id="work-url" readonly></label>
          </div>
        </section>
        <div id="work-play" hidden>
          <div class="work-play-actions work-actions">
            ${button('editor', '返回编辑')}
            ${button('library', '我的关卡')}
            ${button('home', '游戏首页')}
          </div>
          <div id="work-result" class="level-toast work-result" role="status" hidden>
            <p id="work-result-mode" class="toast-kicker"></p>
            <h2 id="work-result-title"></h2>
            <p id="work-result-copy"></p>
            <div class="work-actions">
              ${button('begin', '开始挑战', 'primary-button')}
              ${button('again', '再玩一次', 'primary-button')}
              ${button('editor', '返回编辑', 'primary-button')}
              ${button('import', '复制到我的关卡')}
            </div>
          </div>
        </div>
        <p id="work-link-error" class="work-link-error work-surface" role="status" hidden></p>
      </div>`);
    this.root = shell.querySelector('#workshop-ui')!;
    this.root.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-work]');
      if (target) this.act(target.dataset.work!, target.dataset.id);
    });
    this.root.addEventListener('change', (event) => this.editSetting(event.target as HTMLInputElement | HTMLSelectElement));
    shell.querySelector('#open-workshop')!.addEventListener('click', () => this.library());
  }

  private get puzzle(): Puzzle { return this.work.puzzle; }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }

  private newWork(puzzle: Puzzle): Work {
    return { id: crypto.getRandomValues(new Uint32Array(4)).join('-'), updated: Date.now(), verified: false, puzzle: structuredClone(puzzle) };
  }

  private open(work: Work, saved: boolean): void {
    this.work = structuredClone(work);
    this.dirty = !saved;
    this.history = [];
    this.selected = null;
    this.tool = 'select';
    this.find<HTMLDetailsElement>('.work-settings').open = matchMedia('(min-width: 801px)').matches;
    this.editor();
  }

  private leaveEditor(): boolean {
    return this.find('#work-editor').hidden || !this.dirty || confirm('离开编辑器将丢失尚未保存的修改。继续离开？');
  }

  private library(): void {
    if (!this.leaveEditor()) return;
    this.hide();
    this.callbacks.showWorkshop(false);
    this.find('#work-library').hidden = false;
    this.renderLibrary();
  }

  private renderLibrary(): void {
    const list = this.find('#work-list');
    list.replaceChildren();
    this.find('#work-library-message').textContent = '';
    try {
      for (const work of readWorks()) {
        const row = document.createElement('article');
        row.className = 'work-entry work-surface';
        row.innerHTML = `<h3></h3><p><span></span> <time></time></p><div class="work-actions">
          ${button('edit', '编辑')}${button('saved-trial', '试玩')}${button('saved-share', '分享链接')}
          ${button('copy', '复制')}${button('delete', '删除')}</div>`;
        row.querySelector('h3')!.textContent = work.puzzle.name;
        row.querySelector('span')!.textContent = work.verified ? '已验证' : '草稿';
        row.querySelector('time')!.textContent = dateFormat.format(work.updated);
        row.querySelectorAll<HTMLButtonElement>('button').forEach((action) => { action.dataset.id = work.id; });
        row.querySelector<HTMLButtonElement>('[data-work="saved-share"]')!.disabled = !work.verified;
        list.append(row);
      }
      if (!list.childElementCount) this.find('#work-library-message').textContent = '还没有作品。新建一关，从屋顶开始布光。';
    } catch {
      this.find('#work-library-message').textContent = '无法读取本地作品，请检查浏览器的站点存储权限。';
    }
  }

  private editor(): void {
    this.hide();
    this.callbacks.showWorkshop(true);
    this.find('#work-editor').hidden = false;
    this.find('#work-share').hidden = true;
    const level = puzzleLevel(this.puzzle);
    const state = initialReflectionState(level);
    this.scene.setLevel(level, traceReflection(level, state), false, state);
    this.fillSettings();
    this.updateEditor(false);
  }

  hide(): void {
    for (const selector of ['#work-library', '#work-editor', '#work-play', '#work-link-error']) this.find(selector).hidden = true;
  }

  badLink(): void {
    const message = this.find('#work-link-error');
    message.textContent = '无法打开分享关卡。链接可能已损坏，请确认复制了完整链接。';
    message.hidden = false;
  }

  setShared(puzzle: Puzzle): void {
    this.shared = puzzle;
    this.callbacks.play(puzzle, 'challenge');
  }

  showPlay(mode: PlayMode, phase: 'ready' | 'playing' | 'won'): void {
    this.hide();
    this.find('#work-play').hidden = false;
    const trial = mode === 'trial';
    this.find('.work-play-actions [data-work="editor"]').hidden = !trial;
    this.find('.work-play-actions [data-work="library"]').hidden = trial;
    this.find('.work-play-actions [data-work="home"]').hidden = trial;
    const modal = this.find('#work-result');
    modal.hidden = phase === 'playing';
    if (phase === 'playing') return;
    const won = phase === 'won';
    this.find('#work-result-mode').textContent = trial ? '编辑器试玩' : '玩家关卡挑战';
    this.find('#work-result-title').textContent = won ? trial ? '试玩通过' : '挑战成功' : this.shared!.name;
    this.find('#work-result-copy').textContent = won
      ? trial ? '已验证这份设计。返回编辑器保存或分享。' : '所有通关条件均已满足。'
      : '用库存与屋顶上的器件完成布光。';
    this.find('#work-result [data-work="editor"]').hidden = !trial;
    this.find('#work-result [data-work="begin"]').hidden = won;
    this.find('#work-result [data-work="again"]').hidden = trial || !won;
    this.find('#work-result [data-work="import"]').hidden = trial;
  }

  markVerified(): void {
    if (this.work.verified) return;
    this.work.verified = true;
    this.dirty = true;
  }

  private save(): void {
    const updated = { ...this.work, updated: Date.now() };
    try {
      saveWork(updated);
      this.work = updated;
      this.dirty = false;
      this.find('#work-state').textContent = this.status();
      this.feedback('已保存到此浏览器。');
    } catch {
      this.feedback('保存失败。请检查浏览器的站点存储权限或剩余空间。');
    }
  }

  private async share(): Promise<void> {
    if (!this.work.verified) return;
    const url = shareLink(this.puzzle);
    const input = this.find<HTMLInputElement>('#work-url');
    input.value = url;
    this.find('#work-share').hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      this.feedback('已复制分享链接。');
    } catch {
      input.focus();
      input.select();
      this.feedback('请选择并复制下方链接。');
    }
  }

  private importCopy(puzzle: Puzzle): void {
    const copy = this.newWork({ ...puzzle, name: `${puzzle.name.slice(0, NAME_LIMIT - 3)} 副本` });
    try {
      saveWork(copy);
      this.open(copy, true);
      this.feedback('已复制到我的关卡。');
    } catch {
      this.open(copy, false);
      this.feedback('复制已打开，保存失败。请检查站点存储权限或剩余空间。');
    }
  }

  private act(action: string, id?: string): void {
    if (id) {
      try {
        const work = readWorks().find((item) => item.id === id);
        if (!work) { this.renderLibrary(); return; }
        if (action === 'delete') {
          if (confirm(`删除「${work.puzzle.name}」？`)) { deleteWork(id); this.renderLibrary(); }
        } else if (action === 'copy') {
          this.importCopy(work.puzzle);
        } else {
          this.open(work, true);
          if (action === 'saved-trial') this.callbacks.play(this.puzzle, 'trial');
          if (action === 'saved-share') void this.share();
        }
      } catch {
        this.find('#work-library-message').textContent = '操作失败，请检查浏览器的站点存储权限。';
      }
      return;
    }
    if (action.startsWith('tool-')) {
      this.tool = action.slice(5) as EditorTool;
      if (this.tool !== 'select') this.selected = null;
      this.updateEditor(false);
      return;
    }
    switch (action) {
      case 'home': if (this.leaveEditor()) this.callbacks.home(); return;
      case 'library': this.library(); return;
      case 'new': this.open(this.newWork(newPuzzle()), false); return;
      case 'editor': this.editor(); return;
      case 'save': this.save(); return;
      case 'share': void this.share(); return;
      case 'trial': this.callbacks.play(this.puzzle, 'trial'); return;
      case 'begin': this.callbacks.begin(); return;
      case 'again': this.callbacks.reset(); return;
      case 'import': if (this.shared) this.importCopy(this.shared); return;
      case 'rotate': this.changeSelection('rotate'); return;
      case 'lock': this.changeSelection('lock'); return;
      case 'remove': this.changeSelection('remove'); return;
      case 'move': this.tool = this.tool === 'move' ? 'select' : 'move'; this.updateEditor(false); return;
      case 'clear':
        if (this.puzzle.pieces.length) this.edit((puzzle) => { puzzle.pieces = []; this.selected = null; this.tool = 'select'; });
        return;
      case 'undo': {
        const previous = this.history.pop();
        if (!previous) return;
        const moveCamera = this.puzzle.district !== previous.puzzle.district;
        this.work.puzzle = previous.puzzle;
        this.selected = null;
        this.tool = 'select';
        this.fillSettings();
        this.afterEdit(previous.affectsPlay, moveCamera);
      }
    }
  }

  private editSetting(input: HTMLInputElement | HTMLSelectElement): void {
    if (input.id === 'work-name') {
      const name = input.value.trim() || '未命名关卡';
      input.value = name;
      if (name !== this.puzzle.name) this.edit((puzzle) => { puzzle.name = name; }, false);
      return;
    }
    const kind = PIECE_KINDS.find((item) => input.id === `work-stock-${item}`);
    if (input.id === 'work-district') {
      const district = Number(input.value);
      if (district !== this.puzzle.district) this.edit((puzzle) => { puzzle.district = district; }, false);
      return;
    }
    if (!(input instanceof HTMLInputElement) || (!kind && input.id !== 'work-target')) return;
    const previous = kind ? this.puzzle.inventory[kind] : this.puzzle.lightTargets;
    const value = input.valueAsNumber;
    if (!input.validity.valid || !Number.isInteger(value)) {
      input.value = String(previous);
      this.feedback(kind ? '库存数量须为 0 到 24 的整数。' : '背灯目标须为 1 到 24 的整数。');
      return;
    }
    if (value !== previous) this.edit((puzzle) => {
      if (kind) puzzle.inventory[kind] = value;
      else puzzle.lightTargets = value;
    });
  }

  handleCell(at: GridPoint): void {
    const source = sameCell(at, this.puzzle.source);
    const index = this.puzzle.pieces.findIndex((piece) => sameCell(piece.at, at));
    const occupied = source || index >= 0;
    if (this.tool === 'move' && this.selected) {
      if (occupied) { this.feedback('请选择空屋顶作为目的地。'); return; }
      const from = this.selected;
      this.edit((puzzle) => {
        if (sameCell(from, puzzle.source)) puzzle.source = at;
        else puzzle.pieces.find((piece) => sameCell(piece.at, from))!.at = at;
        this.selected = at;
        this.tool = 'select';
      });
      return;
    }
    if (occupied || this.tool === 'select') {
      this.selected = occupied ? at : null;
      this.tool = 'select';
      this.updateEditor(false);
      return;
    }
    const tool = this.tool;
    if (tool === 'move') return;
    this.edit((puzzle) => {
      if (tool === 'source') puzzle.source = at;
      else puzzle.pieces.push({ at, kind: tool, state: 0, locked: false });
      this.selected = at;
      this.tool = 'select';
    });
  }

  private changeSelection(action: 'rotate' | 'lock' | 'remove'): void {
    if (!this.selected) return;
    const selected = this.selected;
    if (sameCell(selected, this.puzzle.source) && action === 'remove') return;
    this.edit((puzzle) => {
      if (sameCell(selected, puzzle.source)) {
        if (action === 'rotate') puzzle.sourceDirection = ((puzzle.sourceDirection + 1) % 4) as Direction;
        if (action === 'lock') puzzle.sourceRotatable = !puzzle.sourceRotatable;
      } else {
        const index = puzzle.pieces.findIndex((piece) => sameCell(piece.at, selected));
        const piece = puzzle.pieces[index];
        if (action === 'rotate') piece.state = (piece.state + 1) % (piece.kind === 'single' ? 4 : 2);
        if (action === 'lock') piece.locked = !piece.locked;
        if (action === 'remove') { puzzle.pieces.splice(index, 1); this.selected = null; this.tool = 'select'; }
      }
    });
  }

  private edit(change: (puzzle: Puzzle) => void, affectsPlay = true): void {
    const previous = this.puzzle;
    this.history.push({ puzzle: previous, affectsPlay });
    this.work.puzzle = structuredClone(previous);
    change(this.puzzle);
    this.afterEdit(affectsPlay, previous.district !== this.puzzle.district);
  }

  private afterEdit(affectsPlay: boolean, moveCamera: boolean): void {
    if (affectsPlay) this.work.verified = false;
    this.dirty = true;
    this.find('#work-share').hidden = true;
    this.updateEditor(affectsPlay || moveCamera, moveCamera);
  }

  private status(): string {
    return `${this.work.verified ? '已验证' : '草稿'} · ${this.dirty ? '未保存' : '已保存'}`;
  }

  private feedback(message: string): void {
    this.find('#work-feedback').textContent = message;
  }

  private fillSettings(): void {
    this.find<HTMLInputElement>('#work-name').value = this.puzzle.name;
    this.find<HTMLSelectElement>('#work-district').value = String(this.puzzle.district);
    this.find<HTMLInputElement>('#work-target').value = String(this.puzzle.lightTargets);
    for (const kind of PIECE_KINDS) this.find<HTMLInputElement>(`#work-stock-${kind}`).value = String(this.puzzle.inventory[kind]);
  }

  private updateEditor(updateScene: boolean, moveCamera = false): void {
    const level = puzzleLevel(this.puzzle);
    const state = initialReflectionState(level);
    if (updateScene) {
      const trace = traceReflection(level, state);
      if (moveCamera) this.scene.setLevel(level, trace, false, state);
      else this.scene.setBoard(level, trace, state);
    }
    const showsEmpty = this.tool !== 'select';
    this.scene.setToolZones(showsEmpty ? placementZones(level, state) : [], this.selected);
    this.find('#work-state').textContent = this.status();
    const source = this.selected && sameCell(this.puzzle.source, this.selected);
    const piece = this.puzzle.pieces.find((item) => this.selected && sameCell(item.at, this.selected));
    const locked = source ? !this.puzzle.sourceRotatable : piece?.locked;
    this.find('#work-selection').hidden = !this.selected;
    if (source || piece) {
      const name = source ? '光塔' : TOOL_LABELS[piece!.kind];
      const axis = source ? DIRECTIONS[this.puzzle.sourceDirection]
        : piece!.kind === 'single' ? DIRECTIONS[(piece!.state + 3) % 4]
        : piece!.kind === 'checkpoint' ? ['南北', '东西'][piece!.state] : ['/', '\\'][piece!.state];
      this.find('#work-piece').textContent = `${name} · ${axis} · ${locked ? '已锁定' : '可调整'}`;
      this.find('[data-work="lock"]').textContent = locked ? '解锁' : '锁定';
      this.find<HTMLButtonElement>('[data-work="remove"]').disabled = Boolean(source);
    }
    this.find('[data-work="move"]').setAttribute('aria-pressed', String(this.tool === 'move'));
    this.find<HTMLButtonElement>('[data-work="undo"]').disabled = !this.history.length;
    this.find<HTMLButtonElement>('[data-work="clear"]').disabled = !this.puzzle.pieces.length;
    const share = this.find<HTMLButtonElement>('#work-editor [data-work="share"]');
    share.disabled = !this.work.verified;
    share.title = this.work.verified ? '分享链接' : '试玩通关后可以分享';
    for (const choice of this.root.querySelectorAll<HTMLButtonElement>('[data-work^="tool-"]')) {
      choice.setAttribute('aria-pressed', String(choice.dataset.work === `tool-${this.tool}`));
    }
    this.feedback(this.tool === 'move' || this.tool === 'source' ? '点击空屋顶移动器件。'
      : this.tool !== 'select' ? '点击发亮的屋顶摆放器件。'
      : this.selected ? '可旋转、锁定或移动选中的器件。' : '点击屋顶选中器件，或选工具摆放。');
  }
}
